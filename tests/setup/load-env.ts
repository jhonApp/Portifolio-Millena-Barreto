// Integration tests read the local Supabase keys from .env.local (never committed).
// @next/env skips .env.local when NODE_ENV=test (which Vitest sets), so the file is
// loaded with Node's own loader. Variables already in the environment are not overridden.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the tests fail later with a clear ConfigError naming the missing variables.
}
