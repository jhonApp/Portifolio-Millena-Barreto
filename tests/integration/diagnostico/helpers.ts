import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getDatabaseEnv } from "@/lib/diagnostico/env";
import type { Database } from "@/lib/diagnostico/database.types";
import { EmailProviderError, type EmailProvider } from "@/lib/diagnostico/email-provider";
import { generateDiagnosis } from "@/lib/diagnostico/generation";
import { PixGatewayError, type ChargeStatus, type PixCharge, type PixGateway } from "@/lib/diagnostico/pix-gateway";

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

export async function createAttempt(
  db: SupabaseClient<Database>,
  customerId: string,
  preference: "email" | "whatsapp" | "both" = "both",
) {
  const { data, error } = await db
    .from("purchase_attempts")
    .insert({ customer_id: customerId, delivery_preference: preference })
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

/**
 * Throwaway questionnaire version with 15 questions x 4 alternatives (styles from `styleFor`).
 * Returns the version and its questions with their alternatives.
 */
export async function createFullVersion(
  db: SupabaseClient<Database>,
  status: "draft" | "published" | "archived" = "archived",
  styleFor: (questionPosition: number, alternativePosition: number) => Database["public"]["Tables"]["alternatives"]["Row"]["style"] = (_, alt) =>
    (["elegante", "tradicional", "romantico", "esportivo_natural"] as const)[alt - 1],
) {
  const version = await createVersion(db, status);
  const { data: questions, error } = await db
    .from("questions")
    .insert(
      Array.from({ length: 15 }, (_, i) => ({
        version_id: version.id,
        position: i + 1,
        text: `Pergunta de teste ${i + 1}`,
      })),
    )
    .select();
  if (error) throw new Error(`createFullVersion: ${error.message}`);
  const rows = questions!.flatMap((question) =>
    [1, 2, 3, 4].map((position) => ({
      question_id: question.id,
      position,
      text: `Alternativa ${question.position}.${position}`,
      style: styleFor(question.position, position),
      weight: 1,
    })),
  );
  const { error: altError } = await db.from("alternatives").insert(rows);
  if (altError) throw new Error(`createFullVersion: ${altError.message}`);
  const { data: alternatives } = await db
    .from("alternatives")
    .select("id, question_id, position")
    .in("question_id", questions!.map((q) => q.id))
    .order("position");
  return {
    version,
    questions: questions!
      .sort((a, b) => a.position - b.position)
      .map((question) => ({
        ...question,
        alternatives: (alternatives ?? []).filter((alt) => alt.question_id === question.id),
      })),
  };
}

/**
 * Saves answers (first alternative of each question) for an attempt on the published version.
 * `count` limits how many of the 15 questions are answered, in question order.
 */
export async function fillAnswers(db: SupabaseClient<Database>, attemptId: string, count = 15) {
  const { data: published, error } = await db
    .from("questionnaire_versions")
    .select("id")
    .eq("status", "published")
    .single();
  if (error) throw new Error(`fillAnswers: ${error.message}`);
  const { data: questions } = await db
    .from("questions")
    .select("id, position")
    .eq("version_id", published.id)
    .order("position");
  const picked = (questions ?? []).slice(0, count);
  for (const question of picked) {
    const { data: alternative } = await db
      .from("alternatives")
      .select("id")
      .eq("question_id", question.id)
      .order("position")
      .limit(1)
      .single();
    const { error: insertError } = await db.from("answers").insert({
      attempt_id: attemptId,
      version_id: published.id,
      question_id: question.id,
      alternative_id: alternative!.id,
    });
    if (insertError) throw new Error(`fillAnswers: ${insertError.message}`);
  }
}

type GatewayCall = { orderId: string; amountCents: number; expiresInSeconds: number };

/**
 * A gateway that records its calls. `status` is what getCharge reports for every charge
 * (change it per test); `failCreate` / `failCheck` make the matching call throw.
 */
export function recordingGateway(
  options: { failCreate?: boolean; failCheck?: boolean; delayMs?: number; status?: ChargeStatus } = {},
) {
  const calls: GatewayCall[] = [];
  const checks: string[] = [];
  const state = { status: options.status ?? ("PENDING" as ChargeStatus), failCheck: options.failCheck ?? false };
  let counter = 0;
  const gateway: PixGateway = {
    async createCharge(input): Promise<PixCharge> {
      calls.push({ orderId: input.orderId, amountCents: input.amountCents, expiresInSeconds: input.expiresInSeconds });
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      if (options.failCreate) throw new PixGatewayError("GATEWAY_UNAVAILABLE");
      counter += 1;
      return {
        chargeId: `test_${input.orderId}_${counter}`,
        pixCode: `CODE-${counter}`,
        qrImage: "data:image/png;base64,AAA",
        expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
      };
    },
    async getCharge(chargeId) {
      checks.push(chargeId);
      if (state.failCheck) throw new PixGatewayError("GATEWAY_UNAVAILABLE");
      return { status: state.status, expiresAt: null };
    },
  };
  return { gateway, calls, checks, state };
}

/** An order in the given status with a PENDING payment of 990 cents. */
export async function createOrderWithPayment(
  db: SupabaseClient<Database>,
  attemptId: string,
  status: "PENDING" | "FAILED" | "APPROVED" = "PENDING",
  amountCents = 990,
) {
  const order = await createOrder(db, attemptId, status);
  const chargeId = `test_${randomUUID()}`;
  const { data: payment, error } = await db
    .from("payments")
    .insert({
      order_id: order.id,
      provider_charge_id: chargeId,
      amount_cents: amountCents,
      pix_br_code: "CODE",
      pix_qr_image: "data:image/png;base64,AAA",
      expires_at: new Date(Date.now() + 1800_000).toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(`createOrderWithPayment: ${error.message}`);
  return { order, payment, chargeId };
}

export type ReadPdf = { pages: string[]; width: number; height: number; bytes: number };

/** Reads a PDF back: the text of every page and the size of the first page. */
export async function readPdf(bytes: Uint8Array): Promise<ReadPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  const doc = await loading.promise;
  const pages: string[] = [];
  let width = 0;
  let height = 0;
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    if (number === 1) {
      const viewport = page.getViewport({ scale: 1 });
      width = viewport.width;
      height = viewport.height;
    }
    const text = await page.getTextContent();
    pages.push(
      text.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  await loading.destroy();
  return { pages, width, height, bytes: bytes.length };
}

/**
 * Saves the 15 answers of an attempt on the published version, choosing for each question the
 * alternative at index `choose(position)` (0 to 3 in the stored order).
 */
export async function fillAnswersWith(
  db: SupabaseClient<Database>,
  attemptId: string,
  choose: (questionPosition: number) => number,
) {
  const { data: published } = await db.from("questionnaire_versions").select("id").eq("status", "published").single();
  const { data: questions } = await db.from("questions").select("id, position").eq("version_id", published!.id).order("position");
  for (const question of questions ?? []) {
    const { data: alternatives } = await db
      .from("alternatives")
      .select("id")
      .eq("question_id", question.id)
      .order("position");
    const alternative = alternatives![choose(question.position) % alternatives!.length];
    const { error } = await db.from("answers").insert({
      attempt_id: attemptId,
      version_id: published!.id,
      question_id: question.id,
      alternative_id: alternative.id,
    });
    if (error) throw new Error(`fillAnswersWith: ${error.message}`);
  }
}

/** A customer with an attempt, 15 answers and an APPROVED order with a PAID payment. */
export async function createApprovedOrder(
  db: SupabaseClient<Database>,
  options: {
    name?: string;
    email?: string;
    preference?: "email" | "whatsapp" | "both";
    choose?: (questionPosition: number) => number;
    answers?: number;
  } = {},
) {
  const { data: customer, error } = await db
    .from("customers")
    .insert({
      name: options.name ?? "Maria Teste Silva",
      email: options.email ?? `teste-${randomUUID()}@example.com`,
      whatsapp: "+5511912345678",
    })
    .select()
    .single();
  if (error) throw new Error(`createApprovedOrder: ${error.message}`);
  const attempt = await createAttempt(db, customer.id, options.preference);
  if (options.answers === undefined || options.answers === 15) {
    await fillAnswersWith(db, attempt.id, options.choose ?? (() => 0));
  } else {
    await fillAnswers(db, attempt.id, options.answers);
  }
  const { order } = await createOrderWithPayment(db, attempt.id, "APPROVED");
  await db.from("payments").update({ status: "PAID" }).eq("order_id", order.id);
  await db.from("orders").update({ approved_at: new Date().toISOString() }).eq("id", order.id);
  return { customerId: customer.id, attemptId: attempt.id, orderId: order.id, name: customer.name };
}


type RecordedEmail = { to: string; subject: string; html: string; text: string; attachments?: { filename: string; content: Uint8Array }[] };

/** An e-mail provider that records what it is asked to send. `fail` makes every send fail. */
export function recordingEmailProvider(options: { fail?: boolean; delayMs?: number } = {}) {
  const sent: RecordedEmail[] = [];
  const state = { fail: options.fail ?? false };
  const provider: EmailProvider = {
    async send(message) {
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      if (state.fail) throw new EmailProviderError("EMAIL_UNAVAILABLE");
      sent.push(message);
      return { providerId: `rec_${sent.length}` };
    },
  };
  return { provider, sent, state };
}


/** An approved order whose diagnosis was generated by the real RF-07 pipeline (fake PDF bytes, no delivery yet). */
export async function createGeneratedOrder(
  db: SupabaseClient<Database>,
  options: Parameters<typeof createApprovedOrder>[1] = {},
) {
  const created = await createApprovedOrder(db, options);
  await generateDiagnosis(db, created.orderId, {
    deps: {
      renderPdf: async () => new TextEncoder().encode("%PDF-1.4 fake"),
      onDiagnosisReady: async () => {},
    },
  });
  const { data: result } = await db.from("results").select("*").eq("order_id", created.orderId).single();
  const { data: customer } = await db.from("customers").select("email").eq("id", created.customerId).single();
  return { ...created, email: customer!.email, result: result! };
}

// ---- RF-09 helpers: aged data and the records an erasure has to remove ----

/** Makes an attempt older than its 7 days (its cookie and its retention window are over). */
export async function expireAttempt(db: SupabaseClient<Database>, attemptId: string) {
  const { error } = await db
    .from("purchase_attempts")
    .update({ expires_at: new Date(Date.now() - 3600_000).toISOString() })
    .eq("id", attemptId);
  if (error) throw new Error(`expireAttempt: ${error.message}`);
}

/** A paid order (PAID payment) of an attempt in the given status, approved `monthsAgo` months ago. */
export async function addPaidOrder(
  db: SupabaseClient<Database>,
  attemptId: string,
  options: { status?: "APPROVED" | "PROCESSING" | "DELIVERED" | "FAILED"; monthsAgo?: number } = {},
) {
  const { order, payment, chargeId } = await createOrderWithPayment(db, attemptId, "APPROVED");
  const approvedAt = new Date(Date.now() - (options.monthsAgo ?? 0) * 31 * 86400_000).toISOString();
  await db.from("payments").update({ status: "PAID", paid_at: approvedAt }).eq("order_id", order.id);
  const status = options.status ?? "DELIVERED";
  await db
    .from("orders")
    .update({
      status,
      approved_at: approvedAt,
      failure_reason: status === "FAILED" ? "GENERATION_FAILED" : null,
    })
    .eq("id", order.id);
  return { orderId: order.id, paymentId: payment.id, chargeId };
}

/** A result, an e-mail delivery and an access token for a paid order, with the stored PDF reference. */
export async function addDiagnosisRecords(db: SupabaseClient<Database>, orderId: string) {
  const { data: version } = await db.from("questionnaire_versions").select("id").eq("status", "published").single();
  const { error } = await db.from("results").insert({
    order_id: orderId,
    version_id: version!.id,
    points: validPoints,
    predominant_style: "elegante",
    secondary_style: "romantico",
    content: validContent,
    pdf_path: `${orderId}.pdf`,
  });
  if (error) throw new Error(`addDiagnosisRecords: ${error.message}`);
  await db.from("deliveries").insert({ order_id: orderId, channel: "email", status: "SENT" });
  await db
    .from("result_tokens")
    .insert({ order_id: orderId, token_hash: `hash-${randomUUID()}`, expires_at: new Date(Date.now() + 86400_000).toISOString() });
}

/** A customer with one attempt and 15 answers (no order). */
export async function createCustomerWithAnswers(db: SupabaseClient<Database>, email?: string) {
  const { data: customer, error } = await db
    .from("customers")
    .insert({ name: "Maria Teste Silva", email: email ?? `teste-${randomUUID()}@example.com`, whatsapp: "+5511912345678" })
    .select()
    .single();
  if (error) throw new Error(`createCustomerWithAnswers: ${error.message}`);
  const attempt = await createAttempt(db, customer.id);
  await fillAnswersWith(db, attempt.id, () => 0);
  await db.from("consent_records").insert({
    attempt_id: attempt.id,
    customer_id: customer.id,
    consent_text_version: "consent-v1",
    consent_text: "Autorizo",
  });
  return { customerId: customer.id, attemptId: attempt.id, email: customer.email };
}
