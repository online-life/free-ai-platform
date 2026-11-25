import type { AgentCapability } from "./agent.schemas";

export interface AgentCandidate {
  id: string;
  key: string;
  capabilities: AgentCapability[];
  status: string;
  qualityScore: number;
}

export class AgentSelectionService {
  select(
    candidates: AgentCandidate[],
    required: AgentCapability[],
  ): AgentCandidate {
    const eligible = candidates
      .filter((agent) => agent.status === "ACTIVE")
      .filter((agent) => required.every((capability) =>
        agent.capabilities.includes(capability),
      ))
      .sort((a, b) => b.qualityScore - a.qualityScore);

    const selected = eligible[0];
    if (!selected) throw new Error("NO_COMPATIBLE_AGENT");

    return selected;
  }
}
