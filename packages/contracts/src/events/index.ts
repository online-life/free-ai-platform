export interface PlatformEvent<T = unknown> {
  id: string;
  type: string;
  tenantId: string | null;
  projectId: string | null;
  occurredAt: string;
  correlationId: string;
  payload: T;
}

export interface EventHandler<T = unknown> {
  handle(event: PlatformEvent<T>): Promise<void>;
}
