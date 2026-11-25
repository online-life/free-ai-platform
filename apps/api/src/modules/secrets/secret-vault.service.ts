import { withTenantTransaction } from "../../infrastructure/database/transaction";
import type { ProviderRequestScope, CredentialResolver } from "../providers/provider.types";
import { decryptSecret, encryptSecret } from "./encryption";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SecretVaultService implements CredentialResolver {
  async put(input: ProviderRequestScope & { name: string; value: string }): Promise<string> {
    if (!UUID.test(input.tenantId) || !input.name.trim() || !input.value) {
      throw new Error("SECRET_INPUT_INVALID");
    }
    const encoded = encryptSecret(input.value);
    const secret = await withTenantTransaction(input, (tx) => tx.secret.upsert({
      where: {
        tenantId_scopeKey_name: {
          tenantId: input.tenantId,
          scopeKey: input.projectId || "_",
          name: input.name,
        },
      },
      create: {
        tenantId: input.tenantId,
        projectId: input.projectId || null,
        name: input.name,
        ...encoded,
      },
      update: encoded,
      select: { id: true },
    }));
    return this.reference(input.tenantId, input.projectId || null, secret.id);
  }

  async resolve(reference: string, scope: ProviderRequestScope): Promise<string> {
    const parts = reference.split("/");
    if (parts.length !== 4 || !["secret:", "provider-secret:"].includes(parts[0] ?? "")) throw new Error("SECRET_REFERENCE_INVALID");
    const [, tenantId, projectRef, id] = parts;
    if (!tenantId || !projectRef || !id || tenantId !== scope.tenantId || !UUID.test(tenantId)) {
      throw new Error("SECRET_SCOPE_DENIED");
    }
    if (parts[0] === "provider-secret:") {
      const scopeKey = projectRef;
      if (scopeKey !== "_" && scopeKey !== scope.projectId) throw new Error("SECRET_SCOPE_DENIED");
      const credential = await withTenantTransaction(scope, (tx) => tx.providerCredential.findFirst({
        where: { id, tenantId, scopeKey },
        select: { ciphertext: true, iv: true, authTag: true, keyVersion: true },
      }));
      if (!credential) throw new Error("SECRET_NOT_FOUND");
      try {
        return decryptSecret(credential);
      } catch {
        throw new Error("SECRET_DECRYPTION_FAILED");
      }
    }
    if (!UUID.test(id)) throw new Error("SECRET_REFERENCE_INVALID");
    const projectId = projectRef === "_" ? null : projectRef;
    if (projectId && projectId !== scope.projectId) throw new Error("SECRET_SCOPE_DENIED");

    const secret = await withTenantTransaction(scope, (tx) => tx.secret.findFirst({
      where: { id, tenantId, projectId },
      select: { ciphertext: true, iv: true, authTag: true, keyVersion: true },
    }));
    if (!secret) throw new Error("SECRET_NOT_FOUND");
    try {
      return decryptSecret(secret);
    } catch {
      throw new Error("SECRET_DECRYPTION_FAILED");
    }
  }

  async revoke(scope: ProviderRequestScope, reference: string): Promise<boolean> {
    const parts = reference.split("/");
    const tenantId = parts[1];
    const id = parts[3];
    if (parts.length !== 4 || parts[0] !== "secret:" || !tenantId || !id || tenantId !== scope.tenantId || !UUID.test(id)) {
      throw new Error("SECRET_SCOPE_DENIED");
    }
    const projectRef = parts[2];
    if (!projectRef) throw new Error("SECRET_REFERENCE_INVALID");
    const projectId = projectRef === "_" ? null : projectRef;
    if (projectId && projectId !== scope.projectId) throw new Error("SECRET_SCOPE_DENIED");
    const deleted = await withTenantTransaction(scope, (tx) =>
      tx.secret.deleteMany({ where: { id, tenantId, projectId } }),
    );
    return deleted.count === 1;
  }

  private reference(tenantId: string, projectId: string | null, id: string) {
    return `secret:/${tenantId}/${projectId ?? "_"}/${id}`;
  }
}
