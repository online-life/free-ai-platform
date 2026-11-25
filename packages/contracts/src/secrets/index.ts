export interface SecretReference {
  id: string;
  tenantId: string;
  projectId: string | null;
  name: string;
  provider: string;
  version: number;
  createdAt: string;
}

export interface SecretWriteInput {
  name: string;
  provider: string;
  plaintext: string;
}
