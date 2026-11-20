import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getDatabaseEnv } from "@/lib/diagnostico/env";
import type { Database } from "@/lib/diagnostico/database.types";

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): SupabaseClient<Database> {
  const env = getDatabaseEnv();
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
}

export function anonClient(): SupabaseClient<Database> {
  const env = getDatabaseEnv();
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);
}

export const TABLES = [
  "customers",
  "purchase_attempts",
  "consent_records",
  "questionnaire_versions",
  "questions",
  "alternatives",
  "answers",
  "orders",
  "payments",
  "webhook_events",
  "results",
  "deliveries",
  "result_tokens",
  "content_versions",
  "content_templates",
  "automation_errors",
  "deletion_requests",
  "rate_limits",
] as const;

export function uniqueVersion(): number {
  return 100000 + Math.floor(Math.random() * 900000);
}

export async function createCustomer(db: SupabaseClient<Database>) {
  const { data, error } = await db
    .from("customers")
    .insert({
      name: "Maria Teste Silva",
      email: `teste-${randomUUID()}@example.com`,
      whatsapp: "+5511912345678",
    })
    .select()
    .single();
  if (error) throw new Error(`createCustomer: ${error.message}`);
  return data;
}

export async function createAttempt(db: SupabaseClient<Database>, customerId: string) {
  const { data, error } = await db
    .from("purchase_attempts")
    .insert({ customer_id: customerId, delivery_preference: "both" })
    .select()
    .single();
  if (error) throw new Error(`createAttempt: ${error.message}`);
  return data;
}

export async function createOrder(
  db: SupabaseClient<Database>,
  attemptId: string,
  status: string = "PENDING",
) {
  const { data, error } = await db
    .from("orders")
    .insert({
      attempt_id: attemptId,
      amount_cents: 990,
      status,
      failure_reason: status === "FAILED" ? "PIX_EXPIRED" : null,
    })
    .select()
    .single();
  if (error) throw new Error(`createOrder: ${error.message}`);
  return data;
}

export async function createVersion(
  db: SupabaseClient<Database>,
  status: "draft" | "published" | "archived" = "archived",
) {
  const { data, error } = await db
    .from("questionnaire_versions")
    .insert({ version: uniqueVersion(), status })
    .select()
    .single();
  if (error) throw new Error(`createVersion: ${error.message}`);
  return data;
}

export async function createQuestion(
  db: SupabaseClient<Database>,
  versionId: string,
  position: number,
) {
  const { data, error } = await db
    .from("questions")
    .insert({ version_id: versionId, position, text: `Pergunta ${position}` })
    .select()
    .single();
  if (error) throw new Error(`createQuestion: ${error.message}`);
  return data;
}

export const validContent = { blocks: [] };
export const validPoints = {
  esportivo_natural: 1,
  tradicional: 2,
  elegante: 6,
  romantico: 4,
  criativo: 1,
  dramatico: 1,
};
