import type { AgentDefinition } from "./agent.schemas";

export interface AgentActor {
  tenantId: string;
  userId: string;
}

export interface AgentRecord {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "DISABLED" | "DEPRECATED" | "ARCHIVED";
  currentVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentVersionRecord {
  id: string;
  tenantId: string;
  agentId: string;
  version: string;
  definition: AgentDefinition;
  changelog: string;
  createdAt: Date;
}

export interface AgentRepository {
  findByKey(tenantId: string, key: string): Promise<AgentRecord | null>;
  findById(tenantId: string, id: string): Promise<AgentRecord | null>;
  create(tenantId: string, actorId: string, definition: AgentDefinition): Promise<AgentRecord>;
  createVersion(
    tenantId: string,
    actorId: string,
    agentId: string,
    version: string,
    definition: AgentDefinition,
    changelog: string,
  ): Promise<AgentVersionRecord>;
  activate(tenantId: string, agentId: string, version: string, actorId: string): Promise<void>;
  setStatus(tenantId: string, agentId: string, actorId: string, status: "DISABLED" | "ARCHIVED"): Promise<void>;
  list(tenantId: string): Promise<AgentRecord[]>;
}
