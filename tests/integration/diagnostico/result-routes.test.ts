import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleResultPdf } from "@/app/api/diagnostico/result/pdf/handler";
import { DIAGNOSIS_BUCKET, createSignedPdfUrl, diagnosisPdfPath } from "@/lib/diagnostico/diagnosis-storage";
import { generateResultToken, hashToken, mintResultToken } from "@/lib/diagnostico/result-token";
import { adminClient, createGeneratedOrder } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const orderIds: string[] = [];

async function generated() {
  const created = await createGeneratedOrder(db);
  customerIds.push(created.customerId);
  orderIds.push(created.orderId);
  return created;
}

function pdfRequest(body: unknown, raw?: string) {
  return new Request("http://localhost/api/diagnostico/result/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("APP_URL", "http://localhost:3001");
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
  await db.from("rate_limits").delete().like("key", "pdf:%");
});

/** Reads the iat and exp (seconds) of the JWT inside a signed storage URL. */
function lifetimeOf(signedUrl: string): number {
  const jwt = new URL(signedUrl).searchParams.get("token")!;
  const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
  return payload.exp - payload.iat;
}

describe("POST /api/diagnostico/result/pdf", () => {
  it("the PDF route returns a signed URL valid for 300 seconds", async () => {
    const { orderId } = await generated();
    const token = await mintResultToken(db, orderId);
    const response = await handleResultPdf(pdfRequest({ token }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.expiresInSeconds).toBe(300);
    expect(lifetimeOf(body.url)).toBe(300);
  });

  it("the signed URL downloads the PDF of the order", async () => {
    const { orderId } = await generated();
    const body = await (await handleResultPdf(pdfRequest({ token: await mintResultToken(db, orderId) }))).json();
    const file = await fetch(body.url);
    expect(file.status).toBe(200);
    expect(await file.text()).toBe("%PDF-1.4 fake");
  });

  it("the signed URL expires", async () => {
    const { orderId } = await generated();
    const url = await createSignedPdfUrl(db, orderId, 1);
    expect((await fetch(url)).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect((await fetch(url)).ok).toBe(false);
  });

  it("the PDF route answers 404 for an invalid token", async () => {
    const { orderId } = await generated();
    const expired = await mintResultToken(db, orderId);
    await db.from("result_tokens").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", hashToken(expired));
    const revoked = await mintResultToken(db, orderId);
    await db.from("result_tokens").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hashToken(revoked));

    for (const token of [generateResultToken(), expired, revoked]) {
      const response = await handleResultPdf(pdfRequest({ token }));
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Não encontrado." } });
    }
  });

  it("the PDF route answers 404 when no PDF is stored", async () => {
    const { orderId } = await generated();
    await db.from("results").update({ pdf_path: null }).eq("order_id", orderId);
    const response = await handleResultPdf(pdfRequest({ token: await mintResultToken(db, orderId) }));
    expect(response.status).toBe(404);
  });

  it("a malformed token gets 400", async () => {
    const response = await handleResultPdf(pdfRequest({ token: "short" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("invalid JSON gets INVALID_JSON", async () => {
    const response = await handleResultPdf(pdfRequest(null, "{not json"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
  });

  it("the PDF route is rate limited per token", async () => {
    const { orderId } = await generated();
    const token = await mintResultToken(db, orderId);
    for (let i = 0; i < 20; i++) {
      expect((await handleResultPdf(pdfRequest({ token }))).status).toBe(200);
    }
    const blocked = await handleResultPdf(pdfRequest({ token }));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another token is not affected.
    const other = await mintResultToken(db, orderId);
    expect((await handleResultPdf(pdfRequest({ token: other }))).status).toBe(200);
  });
});
