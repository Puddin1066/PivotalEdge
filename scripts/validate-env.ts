import { safeParseEnv } from "@pivotaledge/schemas";

const result = safeParseEnv(process.env);
if (!result.success) {
  console.error("Environment validation failed:");
  console.error(result.error.format());
  process.exit(1);
}

console.log("Environment OK:", {
  NODE_ENV: result.data.NODE_ENV,
  hasOpenAI: Boolean(result.data.OPENAI_API_KEY),
  hasDatabase: Boolean(result.data.DATABASE_URL),
});
