export interface ExecutionPolicy {
  maxTimeoutMs: number;
  maxMemoryMb: number;
  maxCpu: number;
  networkAllowed: boolean;
  allowedTools: string[];
}

export class ExecutionPolicyService {
  enforce(
    requested: {
      timeoutMs: number;
      memoryLimitMb: number;
      cpuLimit: number;
      networkAccess: boolean;
      allowedTools: string[];
    },
    policy: ExecutionPolicy,
  ) {
    if (requested.timeoutMs > policy.maxTimeoutMs) {
      throw new Error("EXECUTION_TIMEOUT_LIMIT_EXCEEDED");
    }
    if (requested.memoryLimitMb > policy.maxMemoryMb) {
      throw new Error("EXECUTION_MEMORY_LIMIT_EXCEEDED");
    }
    if (requested.cpuLimit > policy.maxCpu) {
      throw new Error("EXECUTION_CPU_LIMIT_EXCEEDED");
    }
    if (requested.networkAccess && !policy.networkAllowed) {
      throw new Error("EXECUTION_NETWORK_ACCESS_DENIED");
    }

    const unauthorized = requested.allowedTools.filter(
      (tool) => !policy.allowedTools.includes(tool),
    );
    if (unauthorized.length) {
      throw new Error("EXECUTION_TOOL_NOT_ALLOWED");
    }

    return true;
  }
}
