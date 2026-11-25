export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: Record<string, boolean>;
}

export function buildHealthStatus(
  checks: Record<string, boolean>,
): HealthStatus {
  const values = Object.values(checks);
  const allHealthy = values.length > 0 && values.every(Boolean);
  const allFailed = values.length > 0 && values.every((value) => !value);

  return {
    status: allHealthy ? "healthy" : allFailed ? "unhealthy" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  };
}
