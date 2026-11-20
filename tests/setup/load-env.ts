import nextEnv from "@next/env";

// Integration tests read the local Supabase keys from .env.local (never committed).
nextEnv.loadEnvConfig(process.cwd());
