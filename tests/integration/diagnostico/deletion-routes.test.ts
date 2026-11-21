import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { handleDeletionConfirm } from "@/app/api/diagnostico/privacy/deletion/confirm/handler";
import { handleDeletionRequest } from "@/app/api/diagnostico/privacy/deletion/request/handler";
import { DIAGNOSIS_BUCKET, diagnosisPdfPath } from "@/lib/diagnostico/diagnosis-storage";
import { DELETION_EXPIRED_NOTICE, DELETION_NEUTRAL_MESSAGE } from "@/lib/diagnostico/paths";
import { adminClient, createGeneratedOrder, recordingEmailProvider } from "./helpers";

const db = adminClient();
const startedAt = new Date().toISOString();
const customerIds: string[] = [];
const orderIds: string[] = [];

beforeEach(() => {
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
  await db.from("rate_limits").delete().or("key.like.deletionreq:%,key.like.deletionconfirm:%");
});

function randomIp(): string {
  const n = () => Math.floor(Math.random() * 250) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

function post(path: string, body: unknown, ip: string = randomIp()): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}
const REQUEST_PATH = "/api/diagnostico/privacy/deletion/request";
const CONFIRM_PATH = "/api/diagnostico/privacy/deletion/confirm";

async function deliveredCustomer() {
  const created = await createGeneratedOrder(db);
  customerIds.push(created.customerId);
  orderIds.push(created.orderId);
  await db.from("orders").update({ status: "DELIVERED" }).eq("id", created.orderId);
  return created;
}

function tokenOf(html: string): string {
  const match = /\/exclusao\/([A-Za-z0-9_-]{43})/.exec(html);
  if (!match) throw new Error("no confirmation link in the e-mail");
  return match[1];
}

describe("POST /api/diagnostico/privacy/deletion/request", () => {
  it("a known, an unknown and an over-limit e-mail get the same answer and only the known one gets an e-mail", async () => {
    const mine = await deliveredCustomer();
    const known = recordingEmailProvider();
    const unknown = recordingEmailProvider();
    const knownAnswer = await handleDeletionRequest(post(REQUEST_PATH, { email: mine.email }), { emailProvider: known.provider });
    const unknownAnswer = await handleDeletionRequest(post(REQUEST_PATH, { email: `x-${randomUUID()}@example.com` }), {
      emailProvider: unknown.provider,
    });
    expect(knownAnswer.status).toBe(200);
    expect(unknownAnswer.status).toBe(200);
    expect(known.sent).toHaveLength(1);
    expect(unknown.sent).toHaveLength(0);
    expect(knownAnswer.headers.get("cache-control")).toBe("no-store");

    // The over-limit case is covered below; the three answers are the same body.
    expect(await knownAnswer.json()).toEqual({ message: DELETION_NEUTRAL_MESSAGE });
    expect(await unknownAnswer.json()).toEqual({ message: DELETION_NEUTRAL_MESSAGE });
  });

  it("the answer body is identical", async () => {
    const mine = await deliveredCustomer();
    const ip = randomIp();
    const bodies: string[] = [];
    // A known e-mail, an unknown one and (after the third call) an over-limit one.
    for (const email of [mine.email, `u-${randomUUID()}@example.com`, mine.email, mine.email, mine.email]) {
      const response = await handleDeletionRequest(post(REQUEST_PATH, { email }, ip), { emailProvider: recordingEmailProvider().provider });
      expect(response.status).toBe(200);
      bodies.push(await response.text());
    }
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0])).toEqual({ message: DELETION_NEUTRAL_MESSAGE });
  });

  it("the request limit is 3 an hour per e-mail and 10 per IP", async () => {
    const mine = await deliveredCustomer();
    const provider = recordingEmailProvider();
    const answers: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      const response = await handleDeletionRequest(post(REQUEST_PATH, { email: mine.email }), { emailProvider: provider.provider });
      expect(response.status).toBe(200);
      answers.push(await response.json());
    }
    expect(provider.sent).toHaveLength(3); // the fourth sent nothing...
    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1); // ...and answered the same

    // The per-IP limit: 10 requests from one address, then a known e-mail from the same address.
    const ip = randomIp();
    const other = await deliveredCustomer();
    const ipProvider = recordingEmailProvider();
    for (let i = 0; i < 10; i++) {
      await handleDeletionRequest(post(REQUEST_PATH, { email: `n-${randomUUID()}@example.com` }, ip), { emailProvider: ipProvider.provider });
    }
    const limited = await handleDeletionRequest(post(REQUEST_PATH, { email: other.email }, ip), { emailProvider: ipProvider.provider });
    expect(limited.status).toBe(200);
    expect(await limited.json()).toEqual({ message: DELETION_NEUTRAL_MESSAGE });
    expect(ipProvider.sent).toHaveLength(0);
  });

  it("an invalid e-mail is a 400 with the field", async () => {
    const response = await handleDeletionRequest(post(REQUEST_PATH, { email: "sem-arroba" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields.email).toBeDefined();
  });

  it("a missing APP_URL is a configuration error that names no value", async () => {
    const mine = await deliveredCustomer();
    vi.stubEnv("APP_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleDeletionRequest(post(REQUEST_PATH, { email: mine.email }), {
      emailProvider: recordingEmailProvider().provider,
    });
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("CONFIG_ERROR");
  });
});

describe("POST /api/diagnostico/privacy/deletion/confirm", () => {
  async function confirmationToken() {
    const mine = await deliveredCustomer();
    const { provider, sent } = recordingEmailProvider();
    await handleDeletionRequest(post(REQUEST_PATH, { email: mine.email }), { emailProvider: provider });
    return { mine, token: tokenOf(sent[0].html) };
  }

  it("confirm answers 410 for an expired and for an unknown token with the same body", async () => {
    const { token } = await confirmationToken();
    const { createHash } = await import("node:crypto");
    await db
      .from("deletion_requests")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("token_hash", createHash("sha256").update(token).digest("hex"));

    const expired = await handleDeletionConfirm(post(CONFIRM_PATH, { token }));
    const unknown = await handleDeletionConfirm(post(CONFIRM_PATH, { token: "u".repeat(43) }));
    expect(expired.status).toBe(410);
    expect(unknown.status).toBe(410);
    const expiredBody = await expired.json();
    expect(expiredBody).toEqual(await unknown.json());
    expect(expiredBody.error).toEqual({ code: "LINK_EXPIRED", message: DELETION_EXPIRED_NOTICE });
  });

  it("confirm completes the erasure and answers completed", async () => {
    const { mine, token } = await confirmationToken();
    const response = await handleDeletionConfirm(post(CONFIRM_PATH, { token }), {
      emailProvider: recordingEmailProvider().provider,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "completed" });
    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toEqual([]);
  });

  it("confirm is idempotent for a double click", async () => {
    const { token } = await confirmationToken();
    const completion = recordingEmailProvider();
    const first = await handleDeletionConfirm(post(CONFIRM_PATH, { token }), { emailProvider: completion.provider });
    const second = await handleDeletionConfirm(post(CONFIRM_PATH, { token }), { emailProvider: completion.provider });
    expect(await first.json()).toEqual({ state: "completed" });
    expect(await second.json()).toEqual({ state: "completed" });
    expect(completion.sent).toHaveLength(1);
  });

  it("confirm answers pending while an order is in flight", async () => {
    const { mine, token } = await confirmationToken();
    await db.from("orders").update({ status: "PROCESSING" }).eq("id", mine.orderId);
    const response = await handleDeletionConfirm(post(CONFIRM_PATH, { token }), { emailProvider: recordingEmailProvider().provider });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "pending" });
    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toHaveLength(1);
    await db.from("orders").update({ status: "DELIVERED" }).eq("id", mine.orderId);
  });

  it("a malformed token is a 400 and the limit is 20 calls an hour per IP", async () => {
    const bad = await handleDeletionConfirm(post(CONFIRM_PATH, { token: "curto" }));
    expect(bad.status).toBe(400);
    const ip = randomIp();
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await handleDeletionConfirm(post(CONFIRM_PATH, { token: "k".repeat(43) }, ip))).status;
    }
    expect(last).toBe(429);
  });
});
