import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { handleRetentionJob } from "@/app/api/diagnostico/jobs/retention/handler";
import { pendingDeletionRequestIds } from "@/lib/diagnostico/deletion";
import { DIAGNOSIS_BUCKET, diagnosisPdfPath, downloadDiagnosisPdf } from "@/lib/diagnostico/diagnosis-storage";
import {
  addPaidOrder,
  adminClient,
  createCustomerWithAnswers,
  createGeneratedOrder,
  createOrderWithPayment,
  expireAttempt,
  recordingEmailProvider,
} from "./helpers";

const db = adminClient();
const startedAt = new Date().toISOString();
const SECRET = "r".repeat(32);
const customerIds: string[] = [];
const orderIds: string[] = [];

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("APP_URL", "http://localhost:3001");
});
afterEach(() => {
  vi.unstubAllEnvs();
});
afterAll(async () => {
  if (orderIds.length) await db.storage.from(DIAGNOSIS_BUCKET).remove(orderIds.map(diagnosisPdfPath));
  if (orderIds.length) await db.from("orders").delete().in("id", orderIds);
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  await db.from("deletion_requests").delete().gte("created_at", startedAt);
});

function jobRequest(authorization?: string) {
  return new Request("http://localhost/api/diagnostico/jobs/retention", {
    method: "GET",
    headers: authorization ? { authorization } : {},
  });
}

type Report = {
  deletions: { processed: number; completed: number; pending: number };
  notices: { sent: number; failed: number };
  unpaidAttemptsPurged: number;
  paidCustomersErased: number;
  requestsCleaned: number;
};

async function runJob(options: { now?: Date } = {}): Promise<Report> {
  const response = await handleRetentionJob(jobRequest(`Bearer ${SECRET}`), {
    deletion: { emailProvider: recordingEmailProvider().provider },
    now: options.now,
  });
  expect(response.status).toBe(200);
  return (await response.json()) as Report;
}

/** Runs the job until the batch limit no longer hides anything (the job is global and oldest first). */
async function drain(done: () => Promise<boolean>) {
  for (let i = 0; i < 8 && !(await done()); i++) await runJob();
}

async function customer() {
  const created = await createCustomerWithAnswers(db);
  customerIds.push(created.customerId);
  return created;
}
const exists = async (table: "customers" | "purchase_attempts" | "orders", id: string) =>
  ((await db.from(table).select("id").eq("id", id)).data ?? []).length === 1;

async function deliveredGenerated(monthsAgo: number) {
  const created = await createGeneratedOrder(db);
  customerIds.push(created.customerId);
  orderIds.push(created.orderId);
  const approvedAt = new Date(Date.now() - monthsAgo * 31 * 86400_000).toISOString();
  await db.from("orders").update({ status: "DELIVERED", approved_at: approvedAt }).eq("id", created.orderId);
  await db.from("payments").update({ paid_at: approvedAt }).eq("order_id", created.orderId);
  await expireAttempt(db, created.attemptId);
  return created;
}

describe("GET /api/diagnostico/jobs/retention", () => {
  it("the job requires the cron secret", async () => {
    for (const authorization of [undefined, "Bearer wrong-secret-value-0000000000000000", "Basic abc"]) {
      const response = await handleRetentionJob(jobRequest(authorization));
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    }
  });

  it("a missing secret in the configuration is a configuration error", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleRetentionJob(jobRequest(`Bearer ${SECRET}`));
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("CONFIG_ERROR");
  });

  it("the job answers only counts", async () => {
    const mine = await customer();
    await expireAttempt(db, mine.attemptId);
    const response = await handleRetentionJob(jobRequest(`Bearer ${SECRET}`), {
      deletion: { emailProvider: recordingEmailProvider().provider },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    const body = JSON.parse(text) as Report;
    expect(Object.keys(body).sort()).toEqual(["deletions", "notices", "paidCustomersErased", "requestsCleaned", "unpaidAttemptsPurged"]);
    expect(Object.keys(body.deletions).sort()).toEqual(["completed", "pending", "processed"]);
    for (const personal of [mine.email, mine.customerId, mine.attemptId]) expect(text).not.toContain(personal);
  });

  it("the job deletes unpaid attempts older than 7 days with their answers and consent", async () => {
    const old = await customer();
    await expireAttempt(db, old.attemptId);
    const { order } = await createOrderWithPayment(db, old.attemptId, "PENDING");

    await drain(async () => !(await exists("purchase_attempts", old.attemptId)));

    expect(await exists("purchase_attempts", old.attemptId)).toBe(false);
    expect(await exists("customers", old.customerId)).toBe(false);
    expect(await exists("orders", order.id)).toBe(false);
    expect((await db.from("answers").select("id").eq("attempt_id", old.attemptId)).data).toEqual([]);
    expect((await db.from("consent_records").select("id").eq("attempt_id", old.attemptId)).data).toEqual([]);
  });

  it("a recent unpaid attempt and a paid one stay", async () => {
    const recent = await customer();
    const paidCustomer = await customer();
    await expireAttempt(db, paidCustomer.attemptId);
    const paid = await addPaidOrder(db, paidCustomer.attemptId, { status: "DELIVERED", monthsAgo: 1 });
    orderIds.push(paid.orderId);

    await runJob();

    expect(await exists("purchase_attempts", recent.attemptId)).toBe(true);
    expect(await exists("purchase_attempts", paidCustomer.attemptId)).toBe(true);
    expect(await exists("orders", paid.orderId)).toBe(true);
  });

  it("the job erases paid customers whose last paid order is older than 12 months, including the PDF", async () => {
    const old = await deliveredGenerated(13);
    expect(await downloadDiagnosisPdf(db, old.orderId)).not.toBeNull();

    await drain(async () => !(await exists("customers", old.customerId)));

    expect(await exists("customers", old.customerId)).toBe(false);
    expect(await downloadDiagnosisPdf(db, old.orderId)).toBeNull();
    expect((await db.from("results").select("id").eq("order_id", old.orderId)).data).toEqual([]);
    // The anonymized payment record stays.
    const { data: order } = await db.from("orders").select("attempt_id, status, amount_cents").eq("id", old.orderId).single();
    expect(order).toEqual({ attempt_id: null, status: "DELIVERED", amount_cents: 990 });
    expect((await db.from("payments").select("id").eq("order_id", old.orderId)).data).toHaveLength(1);
  });

  it("a customer with a recent paid order is kept", async () => {
    const recent = await deliveredGenerated(2);
    await runJob();
    expect(await exists("customers", recent.customerId)).toBe(true);
    expect(await downloadDiagnosisPdf(db, recent.orderId)).not.toBeNull();
  });

  it("stale unconfirmed deletion requests are removed", async () => {
    const hash = () => createHash("sha256").update(randomUUID()).digest("hex");
    const day = 86400_000;
    const rows = [
      { label: "stale", token_hash: hash(), expires_at: new Date(Date.now() - 8 * day).toISOString(), confirmed_at: null },
      { label: "recent", token_hash: hash(), expires_at: new Date(Date.now() - 1 * day).toISOString(), confirmed_at: null },
      { label: "confirmed", token_hash: hash(), expires_at: new Date(Date.now() - 9 * day).toISOString(), confirmed_at: new Date().toISOString() },
    ];
    const ids: Record<string, string> = {};
    for (const row of rows) {
      const { label, ...values } = row;
      const { data } = await db.from("deletion_requests").insert({ ...values, email: "ninguem@example.com" }).select("id").single();
      ids[label] = data!.id;
    }
    // Keep the confirmed row out of the way of the pending step.
    await db.from("deletion_requests").update({ completed_at: new Date().toISOString(), email: null }).eq("id", ids.confirmed);

    const report = await runJob();
    expect(report.requestsCleaned).toBeGreaterThanOrEqual(1);
    const left = (await db.from("deletion_requests").select("id").in("id", Object.values(ids))).data!.map((r) => r.id);
    expect(left).not.toContain(ids.stale);
    expect(left).toContain(ids.recent);
    expect(left).toContain(ids.confirmed);
  });

  it("the job finishes a deletion that was waiting for an order in flight", async () => {
    const mine = await createGeneratedOrder(db);
    customerIds.push(mine.customerId);
    orderIds.push(mine.orderId);
    await db.from("orders").update({ status: "PROCESSING" }).eq("id", mine.orderId);
    const { data: request } = await db
      .from("deletion_requests")
      .insert({
        email: mine.email,
        token_hash: createHash("sha256").update(randomUUID()).digest("hex"),
        expires_at: new Date(Date.now() + 86400_000).toISOString(),
        confirmed_at: new Date().toISOString(),
        last_error: "IN_FLIGHT_ORDER",
      })
      .select("id")
      .single();

    const first = await runJob();
    expect(first.deletions.pending).toBeGreaterThanOrEqual(1);
    expect(await exists("customers", mine.customerId)).toBe(true);

    await db.from("orders").update({ status: "DELIVERED" }).eq("id", mine.orderId);
    const second = await runJob();
    expect(second.deletions.completed).toBeGreaterThanOrEqual(1);
    expect(await exists("customers", mine.customerId)).toBe(false);
    const { data: after } = await db.from("deletion_requests").select("completed_at, email").eq("id", request!.id).single();
    expect(after!.completed_at).not.toBeNull();
    expect(after!.email).toBeNull(); // the notice went out and the address was cleared
  });

  it("the job respects the batch sizes", async () => {
    // purge_unpaid_attempts stops at its limit...
    const three = [await customer(), await customer(), await customer()];
    for (const item of three) await expireAttempt(db, item.attemptId);
    const { data: purged } = await db.rpc("purge_unpaid_attempts", { p_limit: 2 });
    expect(purged).toBe(2);
    await drain(async () => (await db.from("purchase_attempts").select("id").in("id", three.map((t) => t.attemptId))).data!.length === 0);

    // ...and so does the list of pending deletion requests.
    for (let i = 0; i < 3; i++) {
      await db.from("deletion_requests").insert({
        email: `lote-${i}@example.com`,
        token_hash: createHash("sha256").update(randomUUID()).digest("hex"),
        expires_at: new Date(Date.now() + 86400_000).toISOString(),
        confirmed_at: new Date().toISOString(),
      });
    }
    expect((await pendingDeletionRequestIds(db, 2)).length).toBe(2);
  });

  it("a second run changes nothing", async () => {
    const old = await customer();
    await expireAttempt(db, old.attemptId);
    await drain(async () => !(await exists("purchase_attempts", old.attemptId)));
    const second = await runJob();
    expect(second.unpaidAttemptsPurged).toBe(0);
    expect(second.paidCustomersErased).toBe(0);
    expect(second.requestsCleaned).toBe(0);
  });
});
