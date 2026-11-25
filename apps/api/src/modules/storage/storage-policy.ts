export interface StoragePolicy {
  maxBytes: number;
  allowedMimeTypes: string[];
  quarantineByDefault: boolean;
}

export const DEFAULT_STORAGE_POLICY: StoragePolicy = {
  maxBytes: 25 * 1024 * 1024,
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
    "application/json",
  ],
  quarantineByDefault: true,
};

export function validateStoredObject(
  mimeType: string,
  sizeBytes: number,
  policy = DEFAULT_STORAGE_POLICY,
): void {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Invalid file size");
  }

  if (sizeBytes > policy.maxBytes) {
    throw new Error("File exceeds configured size limit");
  }

  if (!policy.allowedMimeTypes.includes(mimeType)) {
    throw new Error("File type is not allowed");
  }
}
