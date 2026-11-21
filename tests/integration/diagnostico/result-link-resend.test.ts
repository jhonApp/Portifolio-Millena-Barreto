import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleResultLink } from "@/app/api/diagnostico/result/link/handler";
import { handleResultResend } from "@/app/api/diagnostico/result/resend/handler";
import { ATTEMPT_COOKIE, signAttemptId } from "@/lib/diagnostico/attempt-session";
import { hitRateLimit } from "@/lib/diagnostico/attempts";
import { DIAGNOSIS_BUCKET, diagnosisPdfPath } from "@/lib/diagnostico/diagnosis-storage";
import { RESEND_NEUTRAL_MESSAGE } from "@/lib/diagnostico/paths";
import { clientIpHash } from "@/lib/diagnostico/request-ip";
import { loadResultByToken } from "@/lib/diagnostico/result-page";
import { findResultToken } from "@/lib/diagnostico/result-token";
import { adminClient, createApprovedOrder, createGeneratedOrder, recordingEmailProvider } from "./helpers";

// The result link route (waiting screen) and the "pedir novo link" route (RF-08).

const db = adminClient();
const customerIds: string[] = [];
const orderIds: string[] = [];

async function generated() {
  const created = await createGeneratedOrder(db);
  customerIds.push(created.customerId);
  orderIds.push(created.orderId);
  return created;
}

const cookieFor = (attemptId: string) => `${ATTEMPT_COOKIE}=${signAttemptId(attemptId)}`;

function linkRequest(cookie?: string) {
  return new Request("http://localhost/api/diagnostico/result/link", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
}

function resendRequest(email: unknown, ip: string, raw?: string) {
  return new Request("http://localhost/api/diagnostico/result/resend", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: raw ?? JSON.stringify({ email }),
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
  await db.from("rate_limits").delete().or("key.like.resultlink:%,key.like.resendlink:%");
});

describe("POST /api/diagnostico/result/link", () => {
  it("the link route without a cookie gets 403", async () => {
    const response = await handleResultLink(linkRequest());
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("the link route with a tampered cookie gets 403", async () => {
    const { attemptId } = await generated();
    expect((await handleResultLink(linkRequest(`${ATTEMPT_COOKIE}=${attemptId}.forged`))).status).toBe(403);
  });

  it("the link route before the result exists gets 409 RESULT_NOT_READY", async () => {
    const created = await createApprovedOrder(db);
    customerIds.push(created.customerId);
    orderIds.push(created.orderId);
    const response = await handleResultLink(linkRequest(cookieFor(created.attemptId)));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("RESULT_NOT_READY");
  });

  it("the link route returns a path that loads the result", async () => {
    const { attemptId, orderId } = await generated();
    const response = await handleResultLink(linkRequest(cookieFor(attemptId)));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { path } = await response.json();
    expect(path).toMatch(/^\/diagnostico-estilo\/resultado\/[A-Za-z0-9_-]{43}$/);
    const state = await loadResultByToken(db, path.split("/").pop());
    expect(state).toMatchObject({ state: "ready", orderId });
  });

  it("the link route never opens the order of another attempt", async () => {
    const mine = await generated();
    const other = await generated();
    const { path } = await (await handleResultLink(linkRequest(cookieFor(mine.attemptId)))).json();
    const found = await findResultToken(db, path.split("/").pop());
    expect(found).toEqual({ orderId: mine.orderId });
    expect(found?.orderId).not.toBe(other.orderId);
  });

  it("the link route is rate limited per attempt", async () => {
    const { attemptId } = await generated();
    for (let i = 0; i < 5; i++) {
      expect((await handleResultLink(linkRequest(cookieFor(attemptId)))).status).toBe(200);
    }
    const blocked = await handleResultLink(linkRequest(cookieFor(attemptId)));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("POST /api/diagnostico/result/resend", () => {
  it("a registered e-mail with a result gets a new link by e-mail", async () => {
    const { orderId, email } = await generated();
    const { provider, sent } = recordingEmailProvider();
    const response = await handleResultResend(resendRequest(email, "10.9.0.1"), { delivery: { provider } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: RESEND_NEUTRAL_MESSAGE });

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(email);
    expect(sent[0].attachments).toHaveLength(1);
    const token = /resultado\/([A-Za-z0-9_-]{43})/.exec(sent[0].html)![1];
    expect(await findResultToken(db, token)).toEqual({ orderId });
  });

  it("the e-mail is matched case-insensitively", async () => {
    const { email } = await generated();
    const { provider, sent } = recordingEmailProvider();
    await handleResultResend(resendRequest(email.toUpperCase(), "10.9.0.2"), { delivery: { provider } });
    expect(sent).toHaveLength(1);
  });

  it("an unknown e-mail gets the same answer and no e-mail", async () => {
    const { provider, sent } = recordingEmailProvider();
    const response = await handleResultResend(resendRequest("ninguem-aqui@example.com", "10.9.0.3"), {
      delivery: { provider },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: RESEND_NEUTRAL_MESSAGE });
    expect(sent).toHaveLength(0);
  });

  it("an e-mail of a customer without a diagnosis gets the same answer and no e-mail", async () => {
    const created = await createApprovedOrder(db); // paid, but no diagnosis yet
    customerIds.push(created.customerId);
    orderIds.push(created.orderId);
    const { data: customer } = await db.from("customers").select("email").eq("id", created.customerId).single();
    const { provider, sent } = recordingEmailProvider();
    const response = await handleResultResend(resendRequest(customer!.email, "10.9.0.4"), { delivery: { provider } });
    expect(await response.json()).toEqual({ message: RESEND_NEUTRAL_MESSAGE });
    expect(sent).toHaveLength(0);
  });

  it("the answer body is identical for known unknown and limited e-mails", async () => {
    const { email } = await generated();
    const { provider } = recordingEmailProvider();
    const bodies: string[] = [];
    for (const [value, ip] of [
      [email, "10.9.1.1"],
      ["ninguem@example.com", "10.9.1.2"],
    ] as const) {
      const response = await handleResultResend(resendRequest(value, ip), { delivery: { provider } });
      bodies.push(`${response.status} ${await response.text()}`);
    }
    for (let i = 0; i < 3; i++) await handleResultResend(resendRequest(email, "10.9.1.3"), { delivery: { provider } });
    const limited = await handleResultResend(resendRequest(email, "10.9.1.4"), { delivery: { provider } });
    bodies.push(`${limited.status} ${await limited.text()}`);
    expect(new Set(bodies).size).toBe(1);
  });

  it("the fourth request in an hour sends nothing and answers the same", async () => {
    const { email } = await generated();
    const { provider, sent } = recordingEmailProvider();
    for (let i = 0; i < 3; i++) {
      expect((await handleResultResend(resendRequest(email, `10.9.2.${i}`), { delivery: { provider } })).status).toBe(200);
    }
    expect(sent).toHaveLength(3);
    const fourth = await handleResultResend(resendRequest(email, "10.9.2.9"), { delivery: { provider } });
    expect(fourth.status).toBe(200);
    expect(await fourth.json()).toEqual({ message: RESEND_NEUTRAL_MESSAGE });
    expect(sent).toHaveLength(3);
  });

  it("the per-IP limit sends nothing and answers the same", async () => {
    const { email } = await generated();
    const ip = "10.9.3.1";
    const key = `resendlink:ip:${clientIpHash(resendRequest(email, ip))}`;
    for (let i = 0; i < 10; i++) await hitRateLimit(db, key, 3600, 10);
    const { provider, sent } = recordingEmailProvider();
    const response = await handleResultResend(resendRequest(email, ip), { delivery: { provider } });
    expect(await response.json()).toEqual({ message: RESEND_NEUTRAL_MESSAGE });
    expect(sent).toHaveLength(0);
  });

  it("a send failure is recorded and the answer is still the same", async () => {
    const { email, orderId } = await generated();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { provider } = recordingEmailProvider({ fail: true });
    const response = await handleResultResend(resendRequest(email, "10.9.4.1"), { delivery: { provider } });
    expect(await response.json()).toEqual({ message: RESEND_NEUTRAL_MESSAGE });
    const { data } = await db.from("automation_errors").select("step, context").eq("order_id", orderId);
    expect((data ?? []).map((row) => row.step)).toContain("RESEND_LINK");
    expect(JSON.stringify(data)).not.toContain(email);
  });

  it("a malformed e-mail gets 400", async () => {
    const response = await handleResultResend(resendRequest("not-an-email", "10.9.5.1"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("invalid JSON gets INVALID_JSON", async () => {
    const response = await handleResultResend(resendRequest(null, "10.9.5.2", "{nope"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
  });
});
