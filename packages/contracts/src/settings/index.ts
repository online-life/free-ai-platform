export type SettingScope = "PLATFORM" | "TENANT" | "PROJECT" | "USER";

export interface SettingRecord {
  key: string;
  scope: SettingScope;
  scopeId: string | null;
  value: unknown;
  updatedAt: string;
}
