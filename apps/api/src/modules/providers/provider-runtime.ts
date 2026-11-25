import { ModelSelectionService } from "../model-intelligence/model-selection.service";
import { PrismaModelRepository } from "../model-intelligence/prisma-model.repository";
import { SmartModelRouterService } from "../model-intelligence/smart-model-router.service";
import { SecretVaultService } from "../secrets/secret-vault.service";
import { ProviderAdapterRegistry } from "./provider-adapter.registry";
import { ProviderManagementService } from "./provider-management.service";
import { PrismaProviderRepository } from "./prisma-provider.repository";
import { PrismaProviderUsageRecorder } from "./prisma-provider-usage.recorder";
import { UnifiedGatewayService } from "./unified-gateway.service";

/** Production composition boundary for persisted provider/model routing. */
export function createProviderRuntime() {
  const providers = new PrismaProviderRepository();
  const adapters = new ProviderAdapterRegistry();
  const credentials = new SecretVaultService();
  const gateway = new UnifiedGatewayService(
    providers,
    adapters,
    credentials,
    new PrismaProviderUsageRecorder(),
  );
  const modelSelection = new ModelSelectionService(new PrismaModelRepository());
  return {
    gateway,
    modelSelection,
    router: new SmartModelRouterService(modelSelection, gateway),
    management: new ProviderManagementService(undefined, adapters, credentials),
  };
}
