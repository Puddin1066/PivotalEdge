import { OrchestrationConfigSchema, type OrchestrationConfig } from "@pivotaledge/schemas";

export const DEFAULT_ORCHESTRATION_CONFIG: OrchestrationConfig = OrchestrationConfigSchema.parse({});

export function loadOrchestrationConfig(
  overrides: Partial<OrchestrationConfig> = {},
): OrchestrationConfig {
  const enabled =
    overrides.enabled ??
    (process.env.ORCHESTRATION_ENABLED === "true" || process.env.ORCHESTRATION_ENABLED === "1");
  return OrchestrationConfigSchema.parse({ ...DEFAULT_ORCHESTRATION_CONFIG, ...overrides, enabled });
}

export function isOrchestrationEnabled(config: OrchestrationConfig = loadOrchestrationConfig()): boolean {
  return config.enabled;
}
