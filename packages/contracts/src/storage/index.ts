export interface StoredObject {
  id: string;
  tenantId: string;
  projectId: string | null;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
}
