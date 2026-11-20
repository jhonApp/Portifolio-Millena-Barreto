import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseEnv } from "./env";
import type { Database } from "./database.types";

// The service role client bypasses row-level security and must never reach the browser.
// This module is marked server-only so the bundler refuses to include it in client code.

let adminClient: SupabaseClient<Database> | undefined;
let anonClient: SupabaseClient<Database> | undefined;

const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!adminClient) {
    const env = getDatabaseEnv();
    adminClient = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      authOptions,
    );
  }
  return adminClient;
}

// Anon key, used on the server only (for example the admin login of RF-10).
export function getSupabaseAnon(): SupabaseClient<Database> {
  if (!anonClient) {
    const env = getDatabaseEnv();
    anonClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, authOptions);
  }
  return anonClient;
}
