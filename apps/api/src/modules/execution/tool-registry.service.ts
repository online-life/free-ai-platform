import { ToolDefinitionSchema } from "./execution.schemas";
import type { ToolDefinition } from "./execution.schemas";

export interface RegisteredTool extends ToolDefinition {
  handler: (input: unknown, context: {
    tenantId: string;
    userId: string;
    executionId: string;
  }) => Promise<unknown>;
}

export class ToolRegistryService {
  private readonly tools = new Map<string, RegisteredTool>();

  register(raw: ToolDefinition, handler: RegisteredTool["handler"]) {
    const definition = ToolDefinitionSchema.parse(raw);
    if (this.tools.has(definition.key)) {
      throw new Error("TOOL_ALREADY_REGISTERED");
    }
    this.tools.set(definition.key, { ...definition, handler });
  }

  get(key: string) {
    const tool = this.tools.get(key);
    if (!tool || !tool.enabled) throw new Error("TOOL_NOT_AVAILABLE");
    return tool;
  }

  list() {
    return [...this.tools.values()].map(({ handler: _handler, ...tool }) => tool);
  }

  async invoke(
    key: string,
    input: unknown,
    context: {
      tenantId: string;
      userId: string;
      executionId: string;
    },
  ) {
    const tool = this.get(key);
    if (tool.requiresApproval) throw new Error("TOOL_APPROVAL_REQUIRED");
    return tool.handler(input, context);
  }
}
