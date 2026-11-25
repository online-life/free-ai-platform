import type {
  ProviderAdapter,
  ProviderExecutionRequest,
  ProviderExecutionResult,
} from "./provider.types";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";

type FetchLike = typeof fetch;

export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly providerKey: string;
  private readonly operations = new Set(["CHAT", "STRUCTURED", "EMBEDDINGS"]);
  private readonly baseUrl: URL;

  constructor(
    providerKey: string,
    baseUrl: string,
    private readonly fetcher?: FetchLike,
    private readonly options: { authenticationType?: "BEARER" | "NONE"; customHeaders?: Record<string, string>; allowLocal?: boolean } = {},
    private readonly resolveHost: (hostname: string) => Promise<string[]> = async (hostname) =>
      (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address),
  ) {
    if (!/^[a-z0-9._-]{2,100}$/.test(providerKey)) {
      throw new Error("PROVIDER_KEY_INVALID");
    }
    const url = new URL(baseUrl);
    const localEndpoint = isLoopbackHost(url.hostname);
    if (localEndpoint && options.allowLocal !== true) throw new Error("PROVIDER_LOCAL_ENDPOINT_NOT_ALLOWED");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && localEndpoint && options.allowLocal === true)) {
      throw new Error("PROVIDER_URL_MUST_USE_HTTPS");
    }
    if (url.username || url.password || url.hash || url.search) {
      throw new Error("PROVIDER_URL_INVALID");
    }
    if (!optionsSafeHeaders(this.options.customHeaders ?? {})) {
      throw new Error("PROVIDER_HEADERS_INVALID");
    }
    this.providerKey = providerKey;
    url.pathname = url.pathname.replace(/\/$/, "");
    this.baseUrl = url;
  }

  async execute(
    request: ProviderExecutionRequest,
    credential: string,
  ): Promise<ProviderExecutionResult> {
    if (this.options.authenticationType !== "NONE" && !credential.trim()) {
      throw new Error("PROVIDER_CREDENTIAL_MISSING");
    }

    if (request.operation === "CHAT" || request.operation === "STRUCTURED") {
      if (!request.messages?.length) throw new Error("PROVIDER_MESSAGES_REQUIRED");
      const parameters = { ...request.parameters };
      if (request.operation === "STRUCTURED" && parameters.response_format === undefined) {
        parameters.response_format = { type: "json_object" };
      }
      const response = await this.request("chat/completions", {
        model: request.model,
        messages: request.messages,
        ...parameters,
      }, credential, request.signal);
      const choice = object(array(object(response).choices)[0]);
      const message = object(choice.message);
      const usage = object(response.usage);
      const normalizedUsage = numericUsage(usage);
      return {
        output: message.content ?? message,
        ...(typeof response.id === "string" ? { providerRequestId: response.id } : {}),
        ...(typeof choice.finish_reason === "string" ? { finishReason: choice.finish_reason } : {}),
        ...(normalizedUsage ? { usage: normalizedUsage } : {}),
      };
    }

    if (request.operation === "EMBEDDINGS") {
      if (request.input === undefined) throw new Error("PROVIDER_INPUT_REQUIRED");
      const response = await this.request("embeddings", {
        model: request.model,
        input: request.input,
        ...request.parameters,
      }, credential, request.signal);
      const usage = object(response.usage);
      const normalizedUsage = numericUsage(usage);
      return {
        output: array(response.data).map((item) => object(item).embedding),
        ...(typeof response.id === "string" ? { providerRequestId: response.id } : {}),
        ...(normalizedUsage ? { usage: normalizedUsage } : {}),
      };
    }

    throw new Error("PROVIDER_OPERATION_UNSUPPORTED");
  }

  supports(operation: string): boolean {
    return this.operations.has(operation);
  }

  async discoverModels(credential: string, signal?: AbortSignal): Promise<string[]> {
    const payload = await this.request("models", undefined, credential, signal, "GET");
    return array(payload.data)
      .map((model) => object(model).id)
      .filter((id): id is string => typeof id === "string");
  }

  async listModels(credential: string, signal?: AbortSignal) {
    return this.discoverModels(credential, signal);
  }

  private async request(
    path: string,
    body: unknown,
    credential: string,
    signal?: AbortSignal,
    method: "GET" | "POST" = "POST",
  ): Promise<Record<string, unknown>> {
    const url = new URL(`${this.baseUrl.toString().replace(/\/$/, "")}/${path}`);
    let destination: string;
    try {
      const addresses = await resolveSafeProviderDestination(url, this.resolveHost, this.options.allowLocal === true);
      destination = addresses[0]!;
    } catch (error) {
      if (error instanceof Error && error.message === "PROVIDER_DESTINATION_NOT_ALLOWED") throw error;
      throw new Error("PROVIDER_DNS_RESOLUTION_FAILED");
    }
    const headers = {
      ...this.options.customHeaders,
      ...(this.options.authenticationType === "NONE" ? {} : { authorization: `Bearer ${credential}` }),
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
    };
    const timeoutSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000);
    let status: number;
    let responseBody: string;
    try {
      if (this.fetcher) {
        const response = await this.fetcher(url, {
          method, redirect: "error", headers, signal: timeoutSignal,
          ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
        });
        status = response.status;
        responseBody = await response.text();
      } else {
        const response = await requestPinnedDestination(url, destination, method, headers, method === "POST" ? JSON.stringify(body) : undefined, timeoutSignal);
        status = response.status;
        responseBody = response.body;
      }
    } catch (error) {
      if (signal?.aborted || timeoutSignal.aborted) throw new Error("PROVIDER_TIMEOUT");
      throw new Error("PROVIDER_NETWORK_ERROR", { cause: error });
    }

    if (status < 200 || status >= 300) {
      const statusCode = status === 401 || status === 403
        ? "PROVIDER_AUTHENTICATION_FAILED"
        : status === 429
          ? "PROVIDER_RATE_LIMITED"
          : status >= 500
            ? "PROVIDER_UPSTREAM_UNAVAILABLE"
            : "PROVIDER_REQUEST_REJECTED";
      throw new Error(statusCode);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseBody) as unknown;
    } catch {
      throw new Error("PROVIDER_RESPONSE_INVALID");
    }
    if (!isRecord(parsed)) throw new Error("PROVIDER_RESPONSE_INVALID");
    return parsed;
  }
}

async function resolveSafeProviderDestination(
  url: URL,
  resolver: (hostname: string) => Promise<string[]>,
  allowLocal: boolean,
): Promise<string[]> {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isLoopbackHost(host)) {
    if (!allowLocal) throw new Error("PROVIDER_DESTINATION_NOT_ALLOWED");
    return [host === "localhost" || host.endsWith(".localhost") ? "127.0.0.1" : host];
  }
  const addresses = isIP(host) ? [host] : await resolver(host);
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
    throw new Error("PROVIDER_DESTINATION_NOT_ALLOWED");
  }
  return addresses;
}

async function requestPinnedDestination(
  url: URL,
  address: string,
  method: "GET" | "POST",
  headers: Record<string, string>,
  body: string | undefined,
  signal: AbortSignal,
): Promise<{ status: number; body: string }> {
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    const family = isIP(address);
    if (options.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
  return await new Promise((resolve, reject) => {
    const requestOptions = { method, headers, lookup: pinnedLookup, agent: false, signal, timeout: 15_000 };
    const outgoing = request(url, requestOptions, (incoming) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      incoming.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > 5 * 1024 * 1024) {
          incoming.destroy(new Error("PROVIDER_RESPONSE_TOO_LARGE"));
          return;
        }
        chunks.push(buffer);
      });
      incoming.once("error", reject);
      incoming.once("end", () => resolve({ status: incoming.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
    });
    outgoing.once("error", reject);
    outgoing.once("timeout", () => outgoing.destroy(new Error("PROVIDER_TIMEOUT")));
    if (body !== undefined) outgoing.write(body);
    outgoing.end();
  });
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return true;
  return isIP(host) === 4 && host.startsWith("127.");
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split(".").map(Number);
    const [a = 0, b = 0, c = 0] = octets;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return (normalized.startsWith("2") || normalized.startsWith("3")) &&
      !normalized.startsWith("2001:db8:") &&
      !normalized.startsWith("2001:10:");
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numericUsage(usage: Record<string, unknown>) {
  const result = {
    ...(typeof usage.prompt_tokens === "number" ? { inputTokens: usage.prompt_tokens } : {}),
    ...(typeof usage.completion_tokens === "number" ? { outputTokens: usage.completion_tokens } : {}),
    ...(typeof usage.total_tokens === "number" ? { totalTokens: usage.total_tokens } : {}),
  };
  return Object.keys(result).length ? result : undefined;
}

function optionsSafeHeaders(headers: Record<string, string>): boolean {
  return Object.entries(headers).every(([name, value]) =>
    !/(authorization|api[-_]?key|token|secret|cookie|host|content-length|content-type|connection|transfer-encoding|proxy)/i.test(name) &&
    !/[\r\n]/.test(value),
  );
}
