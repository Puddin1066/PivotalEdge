import { z } from "zod";

/**
 * Environment validation for S0+. Optional keys become required as phases land.
 * Call `parseEnv(process.env)` at process startup.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.union([z.string().url(), z.string().startsWith("postgresql://")]).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  POLYMARKET_GAMMA_URL: z.string().url().optional(),
  POLYMARKET_CLOB_URL: z.string().url().optional(),
});
export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(env: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(env);
}

export function safeParseEnv(env: NodeJS.ProcessEnv = process.env) {
  return EnvSchema.safeParse(env);
}
