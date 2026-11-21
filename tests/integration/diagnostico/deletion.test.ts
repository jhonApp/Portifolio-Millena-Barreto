import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  confirmDeletion,
  isDeletionTokenUsable,
  pendingNoticeIds,
  processDeletionRequest,
  requestDeletion,
  sendCompletionNotice,
} from "@/lib/diagnostico/deletion";
import { DIAGNOSIS_BUCKET, diagnosisPdfPath, downloadDiagnosisPdf } from "@/lib/diagnostico/diagnosis-storage";
import { eraseCustomer } from "@/lib/diagnostico/erasure";
import { adminClient, createGeneratedOrder, createCustomerWithAnswers, recordingEmailProvider } from "./helpers";

const db = adminClient();
const startedAt = new Date().toISOString();
const customerIds: string[] = [];
const orderIds: string[] = [];

beforeEach(() => {
  vi.stubEnv("APP_URL", "http://localhost:3001");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(async () => {
  if (orderIds.length) await db.storage.from(DIAGNOSIS_BUCKET).remove(orderIds.map(diagnosisPdfPath));
  if (orderIds.length) await db.from("orders").delete().in("id", orderIds);
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  await db.from("deletion_requests").delete().gte("created_at", startedAt);
  await db
    .from("automation_errors")
    .delete()
    .gte("created_at", startedAt)
    .in("step", ["DELETION_EMAIL", "DELETION_NOTICE", "DELETION_PENDING", "DELETION_FAILED"]);
});

/** A customer with a delivered diagnosis whose PDF really is in storage. */
async function deliveredCustomer(email?: string) {
  const created = await createGeneratedOrder(db, { email });
  customerIds.push(created.customerId);
  orderIds.push(created.orderId);
  await db.from("orders").update({ status: "DELIVERED" }).eq("id", created.orderId);
  await db.from("consent_records").insert({
    attempt_id: created.attemptId,
    customer_id: created.customerId,
    consent_text_version: "consent-v1",
    consent_text: "Autorizo",
  });
  return created;
}

/** The plain token inside the confirmation e-mail the provider received. */
function tokenOf(html: string): string {
  const match = /\/diagnostico-estilo\/privacidade\/exclusao\/([A-Za-z0-9_-]{43})/.exec(html);
  if (!match) throw new Error("the e-mail has no confirmation link");
  return match[1];
}

async function requestFor(email: string) {
  const { provider, sent } = recordingEmailProvider();
  await requestDeletion(db, email, { emailProvider: provider });
  return { provider, sent };
}

async function requestRow(token: string) {
  const { createHash } = await import("node:crypto");
  const { data } = await db
    .from("deletion_requests")
    .select("*")
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .single();
  return data!;
}

describe("a deletion request", () => {
  it("a known e-mail gets one request with a 24-hour link and an e-mail", async () => {
    const mine = await deliveredCustomer();
    const { sent } = await requestFor(mine.email);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(mine.email);
    expect(sent[0].html).toContain("http://localhost:3001/diagnostico-estilo/privacidade/exclusao/");
    expect(sent[0].html).toContain("/diagnostico-estilo/privacidade"); // the policy link
    const row = await requestRow(tokenOf(sent[0].html));
    expect(row.email).toBe(mine.email);
    expect(row.confirmed_at).toBeNull();
    const hours = (new Date(row.expires_at).getTime() - Date.now()) / 3600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThanOrEqual(24);
    // Only the hash is stored.
    expect(JSON.stringify(row)).not.toContain(tokenOf(sent[0].html));
  });

  it("an unknown e-mail creates nothing and sends nothing", async () => {
    const before = await db.from("deletion_requests").select("id", { count: "exact", head: true });
    const { sent } = await requestFor(`ninguem-${randomUUID()}@example.com`);
    const after = await db.from("deletion_requests").select("id", { count: "exact", head: true });
    expect(sent).toHaveLength(0);
    expect(after.count).toBe(before.count);
  });

  it("a failing confirmation e-mail is recorded and the answer is not an error", async () => {
    const mine = await deliveredCustomer();
    const { provider } = recordingEmailProvider({ fail: true });
    await expect(requestDeletion(db, mine.email, { emailProvider: provider })).resolves.toBeUndefined();
    const { data } = await db
      .from("automation_errors")
      .select("step, message, context")
      .eq("step", "DELETION_EMAIL")
      .gte("created_at", startedAt);
    expect(data!.length).toBeGreaterThan(0);
    expect(JSON.stringify(data)).not.toContain(mine.email);
  });

  it("isDeletionTokenUsable reads validity only", async () => {
    const mine = await deliveredCustomer();
    const { sent } = await requestFor(mine.email);
    const token = tokenOf(sent[0].html);
    expect(await isDeletionTokenUsable(db, token)).toBe(true);
    expect(await isDeletionTokenUsable(db, "x".repeat(43))).toBe(false);
    expect(await isDeletionTokenUsable(db, "short")).toBe(false);
    await db.from("deletion_requests").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", (await requestRow(token)).token_hash);
    expect(await isDeletionTokenUsable(db, token)).toBe(false);
    // The customer is still there: reading changed nothing.
    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toHaveLength(1);
  });
});

describe("confirming a deletion", () => {
  it("confirming within 24 hours erases the customer, answers, results, tokens and PDF and keeps only the anonymized payment", async () => {
    const mine = await deliveredCustomer();
    expect(await downloadDiagnosisPdf(db, mine.orderId)).not.toBeNull();
    const { sent } = await requestFor(mine.email);
    const completion = recordingEmailProvider();

    const result = await confirmDeletion(db, tokenOf(sent[0].html), { emailProvider: completion.provider });
    expect(result).toEqual({ state: "completed" });

    expect(await downloadDiagnosisPdf(db, mine.orderId)).toBeNull();
    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toEqual([]);
    expect((await db.from("purchase_attempts").select("id").eq("id", mine.attemptId)).data).toEqual([]);
    expect((await db.from("answers").select("id").eq("attempt_id", mine.attemptId)).data).toEqual([]);
    expect((await db.from("consent_records").select("id").eq("attempt_id", mine.attemptId)).data).toEqual([]);
    expect((await db.from("results").select("id").eq("order_id", mine.orderId)).data).toEqual([]);
    expect((await db.from("deliveries").select("id").eq("order_id", mine.orderId)).data).toEqual([]);
    expect((await db.from("result_tokens").select("id").eq("order_id", mine.orderId)).data).toEqual([]);

    const { data: order } = await db.from("orders").select("*").eq("id", mine.orderId).single();
    expect(order).toMatchObject({ attempt_id: null, status: "DELIVERED", amount_cents: 990 });
    const { data: payment } = await db.from("payments").select("*").eq("order_id", mine.orderId).single();
    expect(payment).toMatchObject({ amount_cents: 990, status: "PAID", pix_br_code: null, pix_qr_image: null });
  });

  it("the remaining order and payment carry no personal data", async () => {
    const mine = await deliveredCustomer();
    const { sent } = await requestFor(mine.email);
    await confirmDeletion(db, tokenOf(sent[0].html), { emailProvider: recordingEmailProvider().provider });
    const { data: order } = await db.from("orders").select("*").eq("id", mine.orderId).single();
    const { data: payment } = await db.from("payments").select("*").eq("order_id", mine.orderId).single();
    const remains = JSON.stringify([order, payment]);
    for (const personal of [mine.email, mine.name, "5511912345678", "teste-"]) expect(remains).not.toContain(personal);
  });

  it("the completion e-mail is sent once and the address is then cleared", async () => {
    const mine = await deliveredCustomer();
    const { sent } = await requestFor(mine.email);
    const completion = recordingEmailProvider();
    const token = tokenOf(sent[0].html);

    await confirmDeletion(db, token, { emailProvider: completion.provider });
    expect(completion.sent).toHaveLength(1);
    expect(completion.sent[0].to).toBe(mine.email);
    expect(completion.sent[0].subject).toBe("Sua exclusão foi concluída");
    const row = await requestRow(token);
    expect(row.email).toBeNull();
    expect(row.completed_at).not.toBeNull();

    // A second click on the same link changes nothing and sends nothing.
    expect(await confirmDeletion(db, token, { emailProvider: completion.provider })).toEqual({ state: "completed" });
    expect(completion.sent).toHaveLength(1);
  });

  it("a failed completion e-mail is retried by the job", async () => {
    const mine = await deliveredCustomer();
    const { sent } = await requestFor(mine.email);
    const token = tokenOf(sent[0].html);

    const failing = recordingEmailProvider({ fail: true });
    expect(await confirmDeletion(db, token, { emailProvider: failing.provider })).toEqual({ state: "completed" });
    const row = await requestRow(token);
    expect(row.completed_at).not.toBeNull();
    expect(row.email).toBe(mine.email); // kept: the notice is still owed
    expect(await pendingNoticeIds(db, 100)).toContain(row.id);
    const { data: errors } = await db.from("automation_errors").select("step, context").eq("step", "DELETION_NOTICE").gte("created_at", startedAt);
    expect(errors!.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).not.toContain(mine.email);

    const working = recordingEmailProvider();
    expect(await sendCompletionNotice(db, row.id, { emailProvider: working.provider })).toBe(true);
    expect(working.sent).toHaveLength(1);
    expect((await requestRow(token)).email).toBeNull();
    expect(await pendingNoticeIds(db, 100)).not.toContain(row.id);
  });

  it("an expired link erases nothing", async () => {
    const mine = await deliveredCustomer();
    const { sent } = await requestFor(mine.email);
    const token = tokenOf(sent[0].html);
    await db.from("deletion_requests").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", (await requestRow(token)).id);

    expect(await confirmDeletion(db, token)).toEqual({ state: "expired" });
    expect(await confirmDeletion(db, "z".repeat(43))).toEqual({ state: "expired" }); // unknown: the same answer
    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toHaveLength(1);
    expect(await downloadDiagnosisPdf(db, mine.orderId)).not.toBeNull();
  });

  it("all customers with the same e-mail are erased", async () => {
    const email = `mesmo-${randomUUID()}@example.com`;
    const first = await deliveredCustomer(email);
    const second = await createCustomerWithAnswers(db, email);
    customerIds.push(second.customerId);
    const { sent } = await requestFor(email);
    await confirmDeletion(db, tokenOf(sent[0].html), { emailProvider: recordingEmailProvider().provider });
    expect((await db.from("customers").select("id").eq("email", email)).data).toEqual([]);
    expect(await downloadDiagnosisPdf(db, first.orderId)).toBeNull();
  });
});

describe("failures and orders in flight", () => {
  it("an order in flight defers the erasure and the daily job finishes it", async () => {
    const mine = await deliveredCustomer();
    await db.from("orders").update({ status: "PROCESSING" }).eq("id", mine.orderId);
    const { sent } = await requestFor(mine.email);
    const token = tokenOf(sent[0].html);
    const completion = recordingEmailProvider();

    expect(await confirmDeletion(db, token, { emailProvider: completion.provider })).toEqual({ state: "pending" });
    let row = await requestRow(token);
    expect(row).toMatchObject({ last_error: "IN_FLIGHT_ORDER", completed_at: null });
    expect(row.confirmed_at).not.toBeNull();
    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toHaveLength(1);
    expect(await downloadDiagnosisPdf(db, mine.orderId)).not.toBeNull();
    expect(completion.sent).toHaveLength(0); // the customer is told only after completion

    // Another run while it is still in flight records no second error.
    await processDeletionRequest(db, row.id, { emailProvider: completion.provider });
    const { data: errors } = await db
      .from("automation_errors")
      .select("id")
      .eq("step", "DELETION_PENDING")
      .gte("created_at", startedAt)
      .like("message", `%${row.id}%`);
    expect(errors).toHaveLength(1);

    // The order leaves the in-flight states: the next run finishes the erasure.
    await db.from("orders").update({ status: "DELIVERED" }).eq("id", mine.orderId);
    expect(await processDeletionRequest(db, row.id, { emailProvider: completion.provider })).toBe("completed");
    row = await requestRow(token);
    expect(row.completed_at).not.toBeNull();
    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toEqual([]);
    expect(await downloadDiagnosisPdf(db, mine.orderId)).toBeNull();
    expect(completion.sent).toHaveLength(1);
  });

  it("a storage failure keeps the request pending and records DELETION_FAILED", async () => {
    const mine = await deliveredCustomer();
    const { sent } = await requestFor(mine.email);
    const token = tokenOf(sent[0].html);
    const completion = recordingEmailProvider();
    const failingStorage = (client: typeof db, customerId: string) =>
      eraseCustomer(client, customerId, {
        removePdfs: async () => {
          throw new Error("storage down");
        },
      });

    expect(await confirmDeletion(db, token, { emailProvider: completion.provider, erase: failingStorage })).toEqual({ state: "pending" });
    const row = await requestRow(token);
    expect(row.last_error).toBe("STORAGE");
    expect(row.completed_at).toBeNull();
    // Files first, database second: nothing was touched in the database.
    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toHaveLength(1);
    expect((await db.from("results").select("id").eq("order_id", mine.orderId)).data).toHaveLength(1);
    const { data: errors } = await db.from("automation_errors").select("message").eq("step", "DELETION_FAILED").gte("created_at", startedAt);
    expect(errors!.length).toBeGreaterThan(0);

    // The retry finishes it.
    expect(await processDeletionRequest(db, row.id, { emailProvider: completion.provider })).toBe("completed");
    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toEqual([]);
    expect(await downloadDiagnosisPdf(db, mine.orderId)).toBeNull();
  });

  it("a database failure after the files went leaves a retry that finishes", async () => {
    const mine = await deliveredCustomer();
    const files = await eraseCustomer(db, mine.customerId, {
      removePdfs: async (client, ids) => {
        await client.storage.from(DIAGNOSIS_BUCKET).remove(ids.map(diagnosisPdfPath));
        throw new Error("simulated crash before the database step");
      },
    });
    expect(files).toEqual({ result: "failed", stage: "STORAGE" });
    expect(await downloadDiagnosisPdf(db, mine.orderId)).toBeNull(); // files gone, rows still there
    const again = await eraseCustomer(db, mine.customerId);
    expect(again.result).toBe("erased");
    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toEqual([]);
  });
});
