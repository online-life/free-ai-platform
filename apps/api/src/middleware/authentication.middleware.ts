import type { IncomingMessage } from "node:http";
import { AuthenticationService } from "../modules/authentication/authentication.service";

const authentication = new AuthenticationService();

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return undefined; }
  }
  return undefined;
}

export function readCookie(request: IncomingMessage, name: string): string | undefined {
  return cookieValue(request.headers.cookie, name);
}

export async function authenticateRequest(request: IncomingMessage) {
  const cookie = readCookie(request, "freeai_session");
  if (cookie) {
    const separator = cookie.indexOf(".");
    const tenantId = separator > 0 ? cookie.slice(0, separator) : "";
    const token = separator > 0 ? cookie.slice(separator + 1) : "";
    const session = await authentication.validateSession(token, tenantId);
    if (!session) throw new Error("UNAUTHENTICATED");
    return { ...session, token, mechanism: "cookie" as const };
  }

  const authorization = request.headers.authorization;
  const tenantHeader = request.headers["x-tenant-id"];
  const tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;
  if (!authorization?.startsWith("Bearer ") || !tenantId) throw new Error("UNAUTHENTICATED");
  const session = await authentication.validateSession(authorization.slice(7).trim(), tenantId);
  if (!session) throw new Error("UNAUTHENTICATED");
  return { ...session, token: authorization.slice(7).trim(), mechanism: "bearer" as const };
}
