import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { POST } from "@/app/api/diagnostico/attempts/route";
import { ATTEMPT_COOKIE, readAttemptId } from "@/lib/diagnostico/attempt-session";
import { CONSENT_TEXT, CONSENT_VERSION } from "@/lib/diagnostico/consent";
import { adminClient } from "./helpers";

const db = adminClient();
const emails: string[] = [];

function randomIp(): string {
  const n = () => Math.floor(Math.random() * 250) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

function validBody(overrides: Record<string, unknown> = {}) {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  return {
    fullName: "Maria Souza",
    email,
    whatsapp: "(11) 91234-5678",
    deliveryPreference: "both",
    consent: true,
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

function post(body: unknown, ip: string = randomIp(), raw?: string) {
  return POST(
    new Request("http://localhost/api/diagnostico/attempts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: raw ?? JSON.stringify(body),
    }),
  );
}

async function countAttempts(): Promise<number> {
  const { count, error } = await db.from("purchase_attempts").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function attemptsForKey(key: string) {
  const { data } = await db.from("purchase_attempts").select("*").eq("idempotency_key", key);
  return data ?? [];
}

afterAll(async () => {
  if (emails.length) await db.from("customers").delete().in("email", emails);
  await db.from("rate_limits").delete().like("key", "attempt:%");
});

describe("POST /api/diagnostico/attempts", () => {
  it("valid submission creates customer attempt and consent", async () => {
    const body = validBody();
    const response = await post(body);
    expect(response.status).toBe(201);
    const { attemptId } = await response.json();
    expect(attemptId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const { data: attempt } = await db.from("purchase_attempts").select("*").eq("id", attemptId).single();
    expect(attempt?.delivery_preference).toBe("both");
    const { data: customer } = await db.from("customers").select("*").eq("id", attempt!.customer_id).single();
    expect(customer).toMatchObject({
      name: "Maria Souza",
      email: body.email,
      whatsapp: "+5511912345678",
    });
    const { data: consents } = await db.from("consent_records").select("*").eq("attempt_id", attemptId);
    expect(consents).toHaveLength(1);
  });

  it("consent stores text version and accepted_at", async () => {
    const response = await post(validBody());
    const { attemptId } = await response.json();
    const { data: consent } = await db.from("consent_records").select("*").eq("attempt_id", attemptId).single();
    expect(consent?.consent_text_version).toBe(CONSENT_VERSION);
    expect(consent?.consent_text).toBe(CONSENT_TEXT);
    const age = Date.now() - new Date(consent!.accepted_at).getTime();
    expect(age).toBeGreaterThanOrEqual(-5000);
    expect(age).toBeLessThan(60_000);
  });

  it("response sets a signed HttpOnly cookie", async () => {
    const response = await post(validBody());
    const { attemptId } = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${ATTEMPT_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const pair = setCookie.split(";")[0];
    expect(readAttemptId(new Request("http://localhost/x", { headers: { cookie: pair } }))).toBe(attemptId);
  });

  it("empty body creates no attempt", async () => {
    const before = await countAttempts();
    const response = await post({});
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(json.error.fields)).toEqual(
      expect.arrayContaining(["fullName", "email", "whatsapp", "deliveryPreference", "consent"]),
    );
    expect(await countAttempts()).toBe(before);
  });

  it("invalid data sent directly gets 400 with field errors", async () => {
    const before = await countAttempts();
    const response = await post(validBody({ whatsapp: "(11) 1234-5678", consent: false, fullName: "Maria" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.fields.whatsapp).toEqual(["Informe o WhatsApp com DDD"]);
    expect(json.error.fields.consent).toEqual(["Precisamos do seu consentimento para continuar"]);
    expect(json.error.fields.fullName).toEqual(["Informe seu nome completo"]);
    expect(await countAttempts()).toBe(before);
  });

  it("non-JSON body gets INVALID_JSON", async () => {
    const response = await post(null, randomIp(), "{not json");
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
  });

  it("oversized body gets PAYLOAD_TOO_LARGE", async () => {
    const response = await post(null, randomIp(), JSON.stringify({ fullName: "x".repeat(70_000) }));
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("same idempotency key returns the original attempt with 200 and creates nothing", async () => {
    const body = validBody();
    const first = await post(body);
    const second = await post(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).attemptId).toBe((await first.json()).attemptId);
    expect(await attemptsForKey(body.idempotencyKey)).toHaveLength(1);
    const { data: customers } = await db.from("customers").select("id").eq("email", body.email);
    expect(customers).toHaveLength(1);
  });

  it("two concurrent requests with one key create one attempt", async () => {
    const body = validBody();
    const ip = randomIp();
    const [a, b] = await Promise.all([post(body, ip), post(body, ip)]);
    const ids = [(await a.json()).attemptId, (await b.json()).attemptId];
    expect(ids[0]).toBe(ids[1]);
    // Exactly one request creates the attempt (201); the other is answered as a replay (200).
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(await attemptsForKey(body.idempotencyKey)).toHaveLength(1);
    const { data: customers } = await db.from("customers").select("id").eq("email", body.email);
    expect(customers).toHaveLength(1);
  });

  it("ip is stored only as a hash", async () => {
    const ip = "203.0.113.77";
    const response = await post(validBody(), ip);
    const { attemptId } = await response.json();
    const { data } = await db.from("purchase_attempts").select("ip_hash").eq("id", attemptId).single();
    expect(data?.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(data?.ip_hash).not.toContain(ip);
  });

  it("every submission with a new key creates a new attempt", async () => {
    const first = validBody();
    const second = validBody({ email: first.email, idempotencyKey: randomUUID() });
    const ip = randomIp();
    const a = await post(first, ip);
    const b = await post(second, ip);
    expect((await a.json()).attemptId).not.toBe((await b.json()).attemptId);
    const { data: customers } = await db.from("customers").select("id").eq("email", first.email);
    expect(customers).toHaveLength(2);
  });

  it("the eleventh registration from one IP in an hour gets 429 with Retry-After", async () => {
    const ip = randomIp();
    for (let i = 0; i < 10; i++) {
      const response = await post(validBody(), ip);
      expect(response.status, `request ${i + 1}`).toBe(201);
    }
    const response = await post(validBody(), ip);
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("RATE_LIMITED");
    const retryAfter = Number(response.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(3600);
  });

  it("replaying an idempotency key does not count against the limit", async () => {
    const ip = randomIp();
    const first = validBody();
    expect((await post(first, ip)).status).toBe(201);
    for (let i = 0; i < 9; i++) expect((await post(validBody(), ip)).status).toBe(201);
    // Limit reached for new attempts, but a replay is still answered.
    expect((await post(first, ip)).status).toBe(200);
    expect((await post(validBody(), ip)).status).toBe(429);
  });

  it("missing SESSION_SECRET returns CONFIG_ERROR", async () => {
    const saved = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      const body = validBody();
      const response = await post(body);
      expect(response.status).toBe(500);
      expect((await response.json()).error.code).toBe("CONFIG_ERROR");
      expect(await attemptsForKey(body.idempotencyKey)).toHaveLength(0);
    } finally {
      process.env.SESSION_SECRET = saved;
    }
  });
});
