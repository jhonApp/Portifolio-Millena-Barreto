import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { deliverDiagnosis } from "@/lib/diagnostico/delivery";
import { DIAGNOSIS_BUCKET, diagnosisPdfPath } from "@/lib/diagnostico/diagnosis-storage";
import { loadResultByToken } from "@/lib/diagnostico/result-page";
import { generateResultToken, hashToken, mintResultToken } from "@/lib/diagnostico/result-token";
import { adminClient, createApprovedOrder, createGeneratedOrder, recordingEmailProvider } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const orderIds: string[] = [];

async function generated(options: Parameters<typeof createGeneratedOrder>[1] = {}) {
  const created = await createGeneratedOrder(db, options);
  customerIds.push(created.customerId);
  orderIds.push(created.orderId);
  return created;
}

beforeEach(() => {
  vi.stubEnv("APP_URL", "http://localhost:3001");
});
afterEach(() => {
  vi.unstubAllEnvs();
});
afterAll(async () => {
  if (orderIds.length) {
    await db.storage.from(DIAGNOSIS_BUCKET).remove(orderIds.map(diagnosisPdfPath));
    await db.from("automation_errors").delete().in("order_id", orderIds);
  }
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
});

describe("loadResultByToken", () => {
  it("a valid token of a delivered order returns the ready state with the diagnosis", async () => {
    const { orderId, result } = await generated();
    await deliverDiagnosis(db, orderId, { deps: { provider: recordingEmailProvider().provider } });
    const { data: order } = await db.from("orders").select("status").eq("id", orderId).single();
    expect(order!.status).toBe("DELIVERED");

    const token = await mintResultToken(db, orderId);
    const state = await loadResultByToken(db, token);
    expect(state).toMatchObject({ state: "ready", orderId, hasPdf: true });
    expect(state.state === "ready" && state.content).toEqual(result.content);
  });

  it("the ready state carries both styles the percentages and the four blocks", async () => {
    const { orderId, result } = await generated();
    const state = await loadResultByToken(db, await mintResultToken(db, orderId));
    if (state.state !== "ready") throw new Error("expected the ready state");
    expect(state.content.predominant.style).toBe(result.predominant_style);
    expect(state.content.secondary.style).toBe(result.secondary_style);
    expect(Object.values(state.content.percentages).reduce((a, b) => a + b, 0)).toBe(100);
    expect((state.content.blocks as { id: string }[]).map((b) => b.id)).toEqual(["result", "pieces", "accessories", "guidance"]);
  });

  it("an unknown token returns the invalid state", async () => {
    expect(await loadResultByToken(db, generateResultToken())).toEqual({ state: "invalid" });
  });

  it("a malformed token returns the invalid state", async () => {
    for (const token of ["", "abc", "x".repeat(44), "../../etc/passwd"]) {
      expect(await loadResultByToken(db, token)).toEqual({ state: "invalid" });
    }
  });

  it("an expired token returns the invalid state", async () => {
    const { orderId } = await generated();
    const token = await mintResultToken(db, orderId);
    await db.from("result_tokens").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", hashToken(token));
    expect(await loadResultByToken(db, token)).toEqual({ state: "invalid" });
  });

  it("a revoked token returns the invalid state", async () => {
    const { orderId } = await generated();
    const token = await mintResultToken(db, orderId);
    await db.from("result_tokens").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hashToken(token));
    expect(await loadResultByToken(db, token)).toEqual({ state: "invalid" });
  });

  it("the invalid state carries no order data", async () => {
    const { orderId } = await generated();
    const token = generateResultToken();
    const text = JSON.stringify(await loadResultByToken(db, token));
    expect(text).toBe('{"state":"invalid"}');
    expect(text).not.toContain(orderId);
  });

  it("a paid order without a result returns the preparing state", async () => {
    const created = await createApprovedOrder(db);
    customerIds.push(created.customerId);
    orderIds.push(created.orderId);
    const token = await mintResultToken(db, created.orderId);
    expect(await loadResultByToken(db, token)).toEqual({ state: "preparing", orderId: created.orderId });
  });

  it("an order that was never paid returns the unpaid state", async () => {
    const created = await createApprovedOrder(db);
    customerIds.push(created.customerId);
    orderIds.push(created.orderId);
    await db.from("orders").update({ status: "PENDING", approved_at: null }).eq("id", created.orderId);
    await db.from("payments").update({ status: "PENDING" }).eq("order_id", created.orderId);
    const token = await mintResultToken(db, created.orderId);
    expect(await loadResultByToken(db, token)).toEqual({ state: "unpaid" });
  });

  it("a paid order whose delivery failed still shows the result", async () => {
    const { orderId } = await generated();
    await db.from("orders").update({ status: "FAILED", failure_reason: "DELIVERY_FAILED" }).eq("id", orderId);
    const state = await loadResultByToken(db, await mintResultToken(db, orderId));
    expect(state.state).toBe("ready");
  });

  it("a token of another order never shows this order", async () => {
    const first = await generated({ name: "Ana Primeira" });
    const second = await generated({ name: "Bia Segunda" });
    const tokenOfFirst = await mintResultToken(db, first.orderId);
    const state = await loadResultByToken(db, tokenOfFirst);
    expect(state.state === "ready" && state.orderId).toBe(first.orderId);
    expect(JSON.stringify(state)).not.toContain(second.orderId);
    expect(randomUUID()).not.toBe(first.orderId);
  });
});
