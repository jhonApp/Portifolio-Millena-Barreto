import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleGenerationJob } from "@/app/api/diagnostico/jobs/generation/handler";
import { DIAGNOSIS_BUCKET, diagnosisPdfPath } from "@/lib/diagnostico/diagnosis-storage";
import { runDueGenerations, type GenerationDeps } from "@/lib/diagnostico/generation";
import { deliverDiagnosis } from "@/lib/diagnostico/delivery";
import { generateDiagnosis } from "@/lib/diagnostico/generation";
import { adminClient, createApprovedOrder, recordingEmailProvider } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const orderIds: string[] = [];
const SECRET = "j".repeat(32);

const fakePdf = async () => new TextEncoder().encode("%PDF-1.4 fake");
const deps = (extra: GenerationDeps = {}): GenerationDeps => ({ renderPdf: fakePdf, onDiagnosisReady: async () => {}, ...extra });

function jobRequest(authorization?: string) {
  return new Request("http://localhost/api/diagnostico/jobs/generation", {
    method: "GET",
    headers: authorization ? { authorization } : {},
  });
}

async function newOrder() {
  const created = await createApprovedOrder(db);
  customerIds.push(created.customerId);
  orderIds.push(created.orderId);
  return created.orderId;
}

async function orderRow(orderId: string) {
  const { data } = await db.from("orders").select("*").eq("id", orderId).single();
  return data!;
}

async function resultCount(orderId: string) {
  const { count } = await db.from("results").select("*", { count: "exact", head: true }).eq("order_id", orderId);
  return count ?? 0;
}

/** Leaves only the orders of this test in line: a previous test may have left due ones. */
async function isolate(keep: string[]) {
  const others = orderIds.filter((id) => !keep.includes(id));
  if (others.length) {
    await db.from("orders").update({ generation_next_at: new Date(Date.now() + 3600_000).toISOString() }).in("id", others).eq("status", "PROCESSING");
    await db.from("orders").update({ approved_at: new Date().toISOString() }).in("id", others).eq("status", "APPROVED");
  }
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (orderIds.length) {
    await db.storage.from(DIAGNOSIS_BUCKET).remove(orderIds.map(diagnosisPdfPath));
    await db.from("automation_errors").delete().in("order_id", orderIds);
  }
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
});

describe("GET /api/diagnostico/jobs/generation", () => {
  it("the job without the secret returns 401 and runs nothing", async () => {
    const orderId = await newOrder();
    await db.from("orders").update({ approved_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", orderId);
    const response = await handleGenerationJob(jobRequest(), deps());
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect((await orderRow(orderId)).status).toBe("APPROVED");
  });

  it("a wrong secret returns 401", async () => {
    const response = await handleGenerationJob(jobRequest(`Bearer ${"x".repeat(32)}`), deps());
    expect(response.status).toBe(401);
    expect((await handleGenerationJob(jobRequest(SECRET), deps())).status).toBe(401); // no "Bearer" prefix
  });

  it("the job without CRON_SECRET configured returns CONFIG_ERROR", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleGenerationJob(jobRequest("Bearer anything"), deps());
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("CONFIG_ERROR");
  });

  it("the job runs due retries and skips orders that are not due", async () => {
    const due = await newOrder();
    const notDue = await newOrder();
    // Both failed once and wait for a retry; only the first one is due.
    await db.from("orders").update({ status: "PROCESSING", generation_attempts: 1, generation_next_at: new Date(Date.now() - 1000).toISOString() }).eq("id", due);
    await db.from("orders").update({ status: "PROCESSING", generation_attempts: 1, generation_next_at: new Date(Date.now() + 600_000).toISOString() }).eq("id", notDue);
    await isolate([due, notDue]);

    const response = await handleGenerationJob(jobRequest(`Bearer ${SECRET}`), deps());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ processed: 1, succeeded: 1, retrying: 0, failed: 0 });
    expect(await resultCount(due)).toBe(1);
    expect(await resultCount(notDue)).toBe(0);
    expect((await orderRow(notDue)).generation_attempts).toBe(1);
  });

  it("an approved order whose first run never started is picked up after a minute", async () => {
    const orderId = await newOrder();
    await isolate([orderId]);
    // Just approved: not stuck yet.
    expect((await runDueGenerations(db, { limit: 50, deps: deps() })).some((o) => o.orderId === orderId)).toBe(false);
    await db.from("orders").update({ approved_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", orderId);
    const outcomes = await runDueGenerations(db, { limit: 50, deps: deps() });
    expect(outcomes.find((o) => o.orderId === orderId)?.result).toBe("generated");
  });

  it("the job processes at most five orders per run", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      const id = await newOrder();
      await db.from("orders").update({ approved_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", id);
      ids.push(id);
    }
    await isolate(ids);
    const response = await handleGenerationJob(jobRequest(`Bearer ${SECRET}`), deps());
    const body = await response.json();
    expect(body.processed).toBe(5);
    let generated = 0;
    for (const id of ids) generated += await resultCount(id);
    expect(generated).toBe(5);
    // The rest wait for the next minute.
    const second = await handleGenerationJob(jobRequest(`Bearer ${SECRET}`), deps());
    expect((await second.json()).processed).toBe(2);
    // It creates 7 orders and generates 7 results, which passed the default 30 s once on a slow machine.
  }, 120000);

  it("overlapping job runs do not double-generate", async () => {
    const orderId = await newOrder();
    await db.from("orders").update({ approved_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", orderId);
    await isolate([orderId]);
    let renders = 0;
    const slow = deps({
      renderPdf: async () => {
        renders += 1;
        await new Promise((resolve) => setTimeout(resolve, 150));
        return fakePdf();
      },
    });
    await Promise.all([
      handleGenerationJob(jobRequest(`Bearer ${SECRET}`), slow),
      handleGenerationJob(jobRequest(`Bearer ${SECRET}`), slow),
    ]);
    expect(renders).toBe(1);
    expect(await resultCount(orderId)).toBe(1);
  });

  it("the job also runs due deliveries", async () => {
    const orderId = await newOrder();
    await isolate([orderId]);
    // The diagnosis exists and its first e-mail failed: the retry is due.
    vi.stubEnv("APP_URL", "http://localhost:3001");
    await generateDiagnosis(db, orderId, { deps: deps() });
    await deliverDiagnosis(db, orderId, { deps: { provider: recordingEmailProvider({ fail: true }).provider } });
    await db.from("deliveries").update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() }).eq("order_id", orderId);

    const { provider, sent } = recordingEmailProvider();
    const response = await handleGenerationJob(jobRequest(`Bearer ${SECRET}`), { ...deps(), delivery: { provider } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.deliveries.sent).toBeGreaterThanOrEqual(1);
    expect(sent.length).toBeGreaterThanOrEqual(1);
    expect((await orderRow(orderId)).status).toBe("DELIVERED");
  });
});

