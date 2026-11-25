export interface ExecutionArtifact {
  executionId: string;
  tenantId: string;
  projectId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

export interface ArtifactRepository {
  create(artifact: ExecutionArtifact): Promise<unknown>;
  list(
    tenantId: string,
    projectId: string,
    executionId: string,
  ): Promise<unknown[]>;
}

export class ExecutionArtifactService {
  constructor(private readonly repository: ArtifactRepository) {}

  async register(artifact: ExecutionArtifact) {
    if (!artifact.tenantId || !artifact.projectId || !artifact.executionId) {
      throw new Error("ARTIFACT_SCOPE_REQUIRED");
    }
    if (!Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes < 0) {
      throw new Error("ARTIFACT_SIZE_INVALID");
    }
    if (!artifact.storageKey || !artifact.checksum) {
      throw new Error("ARTIFACT_METADATA_INVALID");
    }
    return this.repository.create(artifact);
  }

  async list(
    tenantId: string,
    projectId: string,
    executionId: string,
  ) {
    return this.repository.list(tenantId, projectId, executionId);
  }
}
