export interface HealthStatus {
  status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
  checkedAt: string;
  components: Record<string, string>;
}
