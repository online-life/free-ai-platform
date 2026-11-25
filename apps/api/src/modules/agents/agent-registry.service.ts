import { AgentDefinitionSchema, AgentVersionSchema } from "./agent.schemas";
import type { AgentActor, AgentRepository } from "./agent.types";

export class AgentRegistryService {
  constructor(private readonly repository: AgentRepository) {}

  async register(actor: AgentActor, raw: unknown) {
    const definition = AgentDefinitionSchema.parse(raw);
    const existing = await this.repository.findByKey(actor.tenantId, definition.key);

    if (existing) throw new Error("AGENT_KEY_ALREADY_EXISTS");

    return this.repository.create(
      actor.tenantId,
      actor.userId,
      definition,
    );
  }

  async publishVersion(
    actor: AgentActor,
    agentId: string,
    raw: unknown,
  ) {
    const input = AgentVersionSchema.parse(raw);
    const agent = await this.repository.findById(actor.tenantId, agentId);

    if (!agent) throw new Error("AGENT_NOT_FOUND");

    return this.repository.createVersion(
      actor.tenantId,
      actor.userId,
      agentId,
      input.version,
      input.definition,
      input.changelog,
    );
  }

  async activate(
    actor: AgentActor,
    agentId: string,
    version: string,
  ) {
    const agent = await this.repository.findById(actor.tenantId, agentId);
    if (!agent) throw new Error("AGENT_NOT_FOUND");

    await this.repository.activate(actor.tenantId, agentId, version, actor.userId);

    return { agentId, version, status: "ACTIVE" as const };
  }

  async list(actor: AgentActor) {
    return this.repository.list(actor.tenantId);
  }

  async get(actor: AgentActor, agentId: string) {
    const agent = await this.repository.findById(actor.tenantId, agentId);
    if (!agent) throw new Error("AGENT_NOT_FOUND");
    return agent;
  }

  async disable(actor: AgentActor, agentId: string) {
    const agent = await this.repository.findById(actor.tenantId, agentId);
    if (!agent) throw new Error("AGENT_NOT_FOUND");
    await this.repository.setStatus(actor.tenantId, agentId, actor.userId, "DISABLED");
    return { agentId, status: "DISABLED" as const };
  }

  async archive(actor: AgentActor, agentId: string) {
    const agent = await this.repository.findById(actor.tenantId, agentId);
    if (!agent) throw new Error("AGENT_NOT_FOUND");
    await this.repository.setStatus(actor.tenantId, agentId, actor.userId, "ARCHIVED");
    return { agentId, status: "ARCHIVED" as const };
  }
}
