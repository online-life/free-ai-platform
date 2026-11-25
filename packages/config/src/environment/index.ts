export interface EnvironmentConfig {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  sessionTtlSeconds: number;
}

export function loadEnvironment(
  env: NodeJS.ProcessEnv = process.env
): EnvironmentConfig {
  const nodeEnv = env.NODE_ENV ?? "development";

  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("Invalid NODE_ENV");
  }

  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl && nodeEnv === "production") {
    throw new Error("DATABASE_URL is required in production");
  }

  const ttl = Number(env.SESSION_TTL_SECONDS ?? 3600);

  if (!Number.isSafeInteger(ttl) || ttl < 300 || ttl > 2592000) {
    throw new Error("Invalid SESSION_TTL_SECONDS");
  }

  return {
    nodeEnv: nodeEnv as EnvironmentConfig["nodeEnv"],
    databaseUrl: databaseUrl ?? "",
    sessionTtlSeconds: ttl
  };
}
