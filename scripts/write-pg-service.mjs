import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";

const variable = process.argv[2];
const destination = process.argv[3];
const raw = process.env[variable];
if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(variable ?? "") || !raw || !path.isAbsolute(destination ?? "")) {
  throw new Error("POSTGRES_CONNECTION_CONFIGURATION_REQUIRED");
}
const url = new URL(raw);
if (!(["postgres:", "postgresql:"].includes(url.protocol)) || !url.hostname || !url.pathname.slice(1)) {
  throw new Error("POSTGRES_CONNECTION_URL_INVALID");
}
const fields = {
  host: url.hostname.replace(/^\[|\]$/g, ""),
  port: url.port || "5432",
  dbname: decodeURIComponent(url.pathname.slice(1)),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
};
const sslmode = url.searchParams.get("sslmode");
if (sslmode && ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"].includes(sslmode)) fields.sslmode = sslmode;
for (const value of Object.values(fields)) {
  if (/[\0\r\n]/.test(value)) throw new Error("POSTGRES_CONNECTION_URL_INVALID");
}
const quote = (value) => value;
const content = `[freeai]\n${Object.entries(fields).map(([key, value]) => `${key}=${key === "port" ? value : quote(value)}`).join("\n")}\n`;
await writeFile(destination, content, { mode: 0o600 });
await chmod(destination, 0o600);
