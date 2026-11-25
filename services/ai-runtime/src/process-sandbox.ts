import { lstat, realpath, stat } from "node:fs/promises";
import { spawn } from "node:child_process";

export interface SandboxedProcessInput {
  executable: string;
  args: string[];
  workspacePath: string;
  timeoutMs?: number;
  memoryBytes?: number;
  cpuSeconds?: number;
  maxOutputBytes?: number;
  signal?: AbortSignal;
  environment?: Record<string, string>;
  /**
   * "tool" (default) keeps the original short-lived, network-less limits.
   * "engine" is for a long-running agent engine such as OpenCode: longer wall
   * and CPU bounds, more threads/descriptors, and optional outbound network.
   */
  profile?: "tool" | "engine";
  /** "none" (default) unshares the network namespace. "host" is engine-only. */
  network?: "none" | "host";
  /** One private writable directory mounted at /home/engine (engine-only). */
  engineHomePath?: string;
  /** Called with each complete stdout line as it arrives. */
  onStdoutLine?: (line: string) => void;
}

export interface SandboxedProcessResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MEMORY_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_CPU_SECONDS = 45;
const DEFAULT_OUTPUT_BYTES = 1024 * 1024;

/**
 * Launches one argv-based tool in a fail-closed bubblewrap sandbox.
 * Only the selected workspace is writable; the process receives no network,
 * host home, host /etc, or host process namespace. This requires Linux,
 * bubblewrap, prlimit, and an unprivileged user namespace.
 */
export async function runSandboxedProcess(input: SandboxedProcessInput): Promise<SandboxedProcessResult> {
  if (process.platform !== "linux" || process.getuid?.() === 0) throw new Error("SANDBOX_MUST_RUN_UNPRIVILEGED_ON_LINUX");
  if (!input.executable.startsWith("/") || input.args.length > 256 || input.args.some((arg) => typeof arg !== "string" || arg.length > 8192)) {
    throw new Error("SANDBOX_COMMAND_INVALID");
  }
  const engine = input.profile === "engine";
  if (!engine && (input.network === "host" || input.engineHomePath !== undefined)) throw new Error("SANDBOX_PROFILE_OPTION_DENIED");
  const timeoutMs = bounded(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1000, engine ? 1_800_000 : 300_000, "SANDBOX_TIMEOUT_INVALID");
  const memoryBytes = bounded(input.memoryBytes ?? DEFAULT_MEMORY_BYTES, 128 * 1024 * 1024, 8 * 1024 * 1024 * 1024, "SANDBOX_MEMORY_LIMIT_INVALID");
  const cpuSeconds = bounded(input.cpuSeconds ?? DEFAULT_CPU_SECONDS, 1, engine ? 1800 : 300, "SANDBOX_CPU_LIMIT_INVALID");
  const maxOutputBytes = bounded(input.maxOutputBytes ?? DEFAULT_OUTPUT_BYTES, 1024, 16 * 1024 * 1024, "SANDBOX_OUTPUT_LIMIT_INVALID");
  const workspaceInfo = await lstat(input.workspacePath);
  if (!workspaceInfo.isDirectory() || workspaceInfo.isSymbolicLink()) throw new Error("SANDBOX_WORKSPACE_INVALID");
  const workspace = await realpath(input.workspacePath);
  const executable = await realpath(input.executable);
  const executableInfo = await stat(executable);
  if (!executableInfo.isFile() || (executableInfo.mode & 0o111) === 0) throw new Error("SANDBOX_EXECUTABLE_INVALID");

  let engineHome: string | undefined;
  if (input.engineHomePath !== undefined) {
    const homeInfo = await lstat(input.engineHomePath);
    if (!homeInfo.isDirectory() || homeInfo.isSymbolicLink() || (homeInfo.mode & 0o077) !== 0 || homeInfo.uid !== process.getuid?.()) {
      throw new Error("SANDBOX_ENGINE_HOME_UNSAFE");
    }
    engineHome = await realpath(input.engineHomePath);
    if (engineHome === workspace || engineHome.startsWith(`${workspace}/`) || workspace.startsWith(`${engineHome}/`)) throw new Error("SANDBOX_ENGINE_HOME_UNSAFE");
  }
  const environment = validateEnvironment(input.environment ?? {});
  const sandboxArgs = [
    `--as=${memoryBytes}`,
    `--cpu=${cpuSeconds}`,
    // RLIMIT_NPROC counts threads per real UID; engine runtimes are threaded.
    engine ? "--nproc=1024" : "--nproc=64",
    engine ? "--nofile=1024" : "--nofile=128",
    "--fsize=104857600",
    "--core=0",
    "--",
    "/usr/bin/bwrap",
    "--die-with-parent",
    "--new-session",
    "--unshare-user",
    "--uid", "0", "--gid", "0",
    "--unshare-pid", ...(input.network === "host" ? [] : ["--unshare-net"]), "--unshare-ipc", "--unshare-uts",
    "--ro-bind", "/usr", "/usr",
    "--symlink", "usr/bin", "/bin",
    "--symlink", "usr/lib", "/lib",
    "--symlink", "usr/lib64", "/lib64",
    // Outbound network needs name resolution and the CA bundle only.
    ...(input.network === "host" ? [
      "--dir", "/etc",
      "--ro-bind", "/etc/resolv.conf", "/etc/resolv.conf",
      "--ro-bind", "/etc/ssl", "/etc/ssl",
      "--ro-bind-try", "/etc/ca-certificates", "/etc/ca-certificates",
      "--ro-bind-try", "/etc/hosts", "/etc/hosts",
      "--ro-bind-try", "/etc/nsswitch.conf", "/etc/nsswitch.conf",
    ] : []),
    ...(engineHome ? ["--dir", "/home/engine", "--bind", engineHome, "/home/engine"] : []),
    "--dir", "/workspace",
    "--bind", workspace, "/workspace",
    "--ro-bind", executable, "/tool",
    "--proc", "/proc",
    "--dev", "/dev",
    "--tmpfs", "/tmp",
    "--chdir", "/workspace",
    "--clearenv",
    "--setenv", "PATH", "/usr/bin:/bin",
    "--setenv", "HOME", engineHome ? "/home/engine" : "/tmp",
    "--setenv", "TMPDIR", "/tmp",
    "--setenv", "LANG", "C.UTF-8",
  ];
  for (const [name, value] of Object.entries(environment)) sandboxArgs.push("--setenv", name, value);
  sandboxArgs.push("--", "/tool", ...input.args);

  return await new Promise((resolve, reject) => {
    if (input.signal?.aborted) { reject(new Error("SANDBOX_CANCELLED")); return; }
    const child = spawn("/usr/bin/prlimit", sandboxArgs, { stdio: ["ignore", "pipe", "pipe"], detached: true });
    let stdout = "";
    let stderr = "";
    let captured = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let settled = false;
    const stop = (signal: NodeJS.Signals) => {
      if (child.pid) {
        try { process.kill(-child.pid, signal); } catch { child.kill(signal); }
      } else child.kill(signal);
    };
    const timer = setTimeout(() => { timedOut = true; stop("SIGKILL"); }, timeoutMs);
    const abort = () => stop("SIGKILL");
    input.signal?.addEventListener("abort", abort, { once: true });
    if (input.signal?.aborted) abort();
    let pendingLine = "";
    child.stdout.on("data", (chunk: Buffer) => {
      captured += chunk.length;
      if (captured > maxOutputBytes) { outputLimitExceeded = true; stop("SIGKILL"); return; }
      const text = chunk.toString("utf8");
      stdout += text;
      if (input.onStdoutLine) {
        pendingLine += text;
        let newline = pendingLine.indexOf("\n");
        while (newline >= 0) {
          const line = pendingLine.slice(0, newline);
          pendingLine = pendingLine.slice(newline + 1);
          try { input.onStdoutLine(line); } catch { /* observer errors must not break the sandbox */ }
          newline = pendingLine.indexOf("\n");
        }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      captured += chunk.length;
      if (captured > maxOutputBytes) { outputLimitExceeded = true; stop("SIGKILL"); return; }
      stderr += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
      reject(new Error("SANDBOX_LAUNCH_FAILED", { cause: error }));
    });
    child.once("close", (code, signal) => {
      if (input.onStdoutLine && pendingLine) { try { input.onStdoutLine(pendingLine); } catch { /* ignore */ } }
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
      resolve({ code, signal, stdout, stderr, timedOut, outputLimitExceeded });
    });
  });
}

function bounded(value: number, minimum: number, maximum: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(code);
  return value;
}

function validateEnvironment(environment: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(environment)) {
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(name) || /(AUTH|TOKEN|SECRET|PASSWORD|CREDENTIAL|COOKIE|API_KEY)/i.test(name)
      || typeof value !== "string" || value.length > 4096 || /[\0\r\n]/.test(value)) {
      throw new Error("SANDBOX_ENVIRONMENT_INVALID");
    }
    result[name] = value;
  }
  return result;
}
