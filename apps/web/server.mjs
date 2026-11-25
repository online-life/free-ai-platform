import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.WEB_PORT || 4173);
const host = process.env.WEB_HOST || "127.0.0.1";
const apiBase = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";
const apiOrigin = (() => {
  if (apiBase === "") return "'self'";
  if (apiBase.startsWith("/")) {
    if (apiBase.startsWith("//") || apiBase.includes("?") || apiBase.includes("#")) throw new Error("API_BASE_URL_INVALID");
    return "'self'";
  }
  const url = new URL(apiBase);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("API_BASE_URL_INVALID");
  }
  return url.origin;
})();
const contentSecurityPolicy = `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' ${apiOrigin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8", ".svg": "image/svg+xml" };

const server = createServer(async (request, response) => {
  response.setHeader("X-Free-AI-Platform-Server", "web-preview-v1");
  if (request.url === "/health" && (request.method === "GET" || request.method === "HEAD")) {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(request.method === "HEAD" ? undefined : JSON.stringify({ status: "healthy" }));
    return;
  }
  if (request.url === "/config.js" && (request.method === "GET" || request.method === "HEAD")) {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": contentSecurityPolicy });
    response.end(request.method === "HEAD" ? undefined : `window.FREE_AI_API_BASE = ${JSON.stringify(apiBase)};`);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname); }
  catch { response.writeHead(400).end("Bad request"); return; }
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${sep}`)) { response.writeHead(403).end("Forbidden"); return; }
  try {
    const body = await readFile(target);
    response.writeHead(200, { "Content-Type": types[extname(target)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": contentSecurityPolicy });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    if (extname(pathname)) { response.writeHead(404).end("Not found"); return; }
    try { const body = await readFile(resolve(root, "index.html")); response.writeHead(200, { "Content-Type": types[".html"], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }).end(body); }
    catch { response.writeHead(500).end("Frontend entry point unavailable"); }
  }
});

server.on("error", async (error) => {
  if (error.code === "EADDRINUSE") {
    let isManagedInstance = false;
    try {
      const response = await fetch(`http://${host}:${port}/health`, { signal: AbortSignal.timeout(700) });
      isManagedInstance = response.ok && response.headers.get("x-free-ai-platform-server") === "web-preview-v1";
    } catch { /* an occupied port is reported below */ }
    if (isManagedInstance) {
      process.stdout.write(`Free AI Platform web preview is already healthy at http://${host}:${port}; reusing it.\n`);
      process.exitCode = 0;
      return;
    }
    process.stderr.write(`Cannot start Free AI Platform web preview: ${host}:${port} is already in use by another process. Set WEB_PORT to an available port; the existing process was left untouched.\n`);
  } else {
    process.stderr.write(`Cannot start Free AI Platform web preview: ${error.message}\n`);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => process.stdout.write(`Free AI Platform web preview listening on http://${host}:${port}\n`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
