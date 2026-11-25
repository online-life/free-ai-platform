/**
 * Provider-neutral interface only.
 * No provider SDK, credentials, model name, or inference implementation.
 */
export interface GenerationRequest {
  readonly taskId: string;
  readonly projectId: string;
  readonly input: unknown;
  readonly outputSchema?: unknown;
  readonly timeoutMs: number;
}

export interface GenerationResult {
  readonly output: unknown;
  readonly usage?: {
    readonly inputUnits?: number;
    readonly outputUnits?: number;
  };
}

export interface ModelRuntime {
  generate(request: GenerationRequest): Promise<GenerationResult>;
}
