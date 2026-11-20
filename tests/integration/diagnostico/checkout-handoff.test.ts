import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { POST as register } from "@/app/api/diagnostico/attempts/route";
import { PUT as saveAnswerRoute } from "@/app/api/diagnostico/answers/route";
import { POST as checkout } from "@/app/api/diagnostico/checkout/route";
import { ATTEMPT_COOKIE, signAttemptId } from "@/lib/diagnostico/attempt-session";
import { resolveCheckoutAccess } from "@/lib/diagnostico/checkout";
import { INCOMPLETE_PATH } from "@/lib/diagnostico/paths";
import { loadQuestionBank } from "@/lib/diagnostico/question-bank";
import { adminClient } from "./helpers";

// Hand-off tests of RF-05 as the consumer of RF-02 (customer and attempt) and RF-04 (saved answers).
// The real registration route and the real save route feed the real checkout route.

const db = adminClient();
const emails: string[] = [];

function randomIp(): string {
  const n = () => Math.floor(Math.random() * 250) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

async function registerCustomer(fullName = "Maria Souza") {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const response = await register(
    new Request("http://localhost/api/diagnostico/attempts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": randomIp() },
      body: JSON.stringify({
        fullName,
        email,
        whatsapp: "(11) 91234-5678",
        deliveryPreference: "both",
        consent: true,
        idempotencyKey: randomUUID(),
      }),
    }),
  );
  expect(response.status).toBe(201);
  const { attemptId } = await response.json();
  const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];
  return { attemptId: attemptId as string, cookie, email, fullName };
}

async function saveAnswers(cookie: string, count: number) {
  const bank = await loadQuestionBank(db);
  for (const question of bank.questions.slice(0, count)) {
    const response = await saveAnswerRoute(
      new Request("http://localhost/api/diagnostico/answers", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ questionId: question.id, alternativeId: question.alternatives[0].id }),
      }),
    );
    expect(response.status).toBe(200);
  }
}

function openCheckout(cookie: string) {
  return checkout(
    new Request("http://localhost/api/diagnostico/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
    }),
  );
}

const storeFor = (attemptId: string) => ({
  get: (name: string) => (name === ATTEMPT_COOKIE ? { value: signAttemptId(attemptId) } : undefined),
});

beforeEach(() => {
  vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "true");
  vi.stubEnv("PAYMENT_SIMULATION_FAIL", "false");
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  if (emails.length) await db.from("customers").delete().in("email", emails);
  await db.from("rate_limits").delete().or("key.like.attempt:%,key.like.checkout:%");
});

describe("RF-02 and RF-04 to RF-05 hand-off", () => {
  it("a real registration with 15 saved answers opens a checkout whose order belongs to that customer", async () => {
    const customer = await registerCustomer("Maria Souza");
    const other = await registerCustomer("Ana Lima");
    await saveAnswers(customer.cookie, 15);

    const response = await openCheckout(customer.cookie);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.state).toBe("pending");
    expect(body.amountCents).toBe(990);

    // The order belongs to the attempt returned by RF-02 ...
    const { data: order } = await db.from("orders").select("*").eq("id", body.orderId).single();
    expect(order!.attempt_id).toBe(customer.attemptId);
    expect(order).toMatchObject({ status: "PENDING", amount_cents: 990 });

    // ... and through the attempt it reaches the exact name and e-mail typed in the registration.
    const { data: attempt } = await db.from("purchase_attempts").select("customer_id").eq("id", order!.attempt_id).single();
    const { data: person } = await db.from("customers").select("name, email").eq("id", attempt!.customer_id).single();
    expect(person).toEqual({ name: customer.fullName, email: customer.email });

    // The charge is tied to the order: the simulated gateway builds its code from the order id.
    expect(body.pixCode).toContain(body.orderId.replace(/-/g, ""));

    // Another registration has no order.
    const { data: otherOrders } = await db.from("orders").select("id").eq("attempt_id", other.attemptId);
    expect(otherOrders).toHaveLength(0);
  });

  it("answers saved by the RF-04 route with one question missing send RF-05 back to the questionnaire", async () => {
    const customer = await registerCustomer();
    await saveAnswers(customer.cookie, 14);

    expect(await resolveCheckoutAccess(db, storeFor(customer.attemptId))).toEqual({
      ok: false,
      redirectTo: INCOMPLETE_PATH,
    });
    const blocked = await openCheckout(customer.cookie);
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error.code).toBe("ANSWERS_INCOMPLETE");
    const { data: orders } = await db.from("orders").select("id").eq("attempt_id", customer.attemptId);
    expect(orders).toHaveLength(0);

    // Saving the 15th answer through RF-04 opens the checkout.
    const bank = await loadQuestionBank(db);
    const last = bank.questions[14];
    const saved = await saveAnswerRoute(
      new Request("http://localhost/api/diagnostico/answers", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: customer.cookie },
        body: JSON.stringify({ questionId: last.id, alternativeId: last.alternatives[0].id }),
      }),
    );
    expect(saved.status).toBe(200);
    expect(await resolveCheckoutAccess(db, storeFor(customer.attemptId))).toEqual({
      ok: true,
      attemptId: customer.attemptId,
    });
    expect((await openCheckout(customer.cookie)).status).toBe(201);
  });
});
