import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PUT as saveAnswerRoute } from "@/app/api/diagnostico/answers/route";
import { POST as checkoutRoute } from "@/app/api/diagnostico/checkout/route";
import { handlePaymentCheck } from "@/app/api/diagnostico/payment/check/handler";
import { handleResultLink } from "@/app/api/diagnostico/result/link/handler";
import { handleResultPdf } from "@/app/api/diagnostico/result/pdf/handler";
import { handleResultResend } from "@/app/api/diagnostico/result/resend/handler";
import { ATTEMPT_COOKIE, signAttemptId } from "@/lib/diagnostico/attempt-session";
import { DIAGNOSIS_BUCKET, diagnosisPdfPath } from "@/lib/diagnostico/diagnosis-storage";
import { RESEND_NEUTRAL_MESSAGE } from "@/lib/diagnostico/paths";
import { loadQuestionBank } from "@/lib/diagnostico/question-bank";
import { loadQuestionnaire } from "@/lib/diagnostico/questionnaire-page";
import { loadResultByToken } from "@/lib/diagnostico/result-page";
import { findResultToken, mintResultToken } from "@/lib/diagnostico/result-token";
import { adminClient, createCustomerWithAnswers, createGeneratedOrder, recordingEmailProvider, recordingGateway } from "./helpers";

// RF-09 criterion: a customer-facing request made with another customer's identifiers returns nothing
// of that customer. Customer A is the victim; B is another buyer; C is a registered customer who has
// not paid. Every route is driven with B's or C's credentials and with A's ids in the body.

const db = adminClient();
const customerIds: string[] = [];
const orderIds: string[] = [];

type Buyer = Awaited<ReturnType<typeof createGeneratedOrder>>;
let A: Buyer;
let B: Buyer;
let C: Awaited<ReturnType<typeof createCustomerWithAnswers>>;
let tokenA: string;
let tokenB: string;

const cookieFor = (attemptId: string) => `${ATTEMPT_COOKIE}=${signAttemptId(attemptId)}`;
const randomIp = () => `10.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

async function buyer(name: string): Promise<Buyer> {
  const created = await createGeneratedOrder(db, { name });
  customerIds.push(created.customerId);
  orderIds.push(created.orderId);
  await db.from("orders").update({ status: "DELIVERED" }).eq("id", created.orderId);
  return created;
}

/** Everything that identifies customer A: the response of another customer's request never has it. */
function expectNothingOfA(text: string) {
  for (const secret of [A.email, "Alice", A.orderId, A.attemptId, A.customerId, tokenA, "5511912345678"]) {
    expect(text, `the answer leaked ${secret.slice(0, 6)}…`).not.toContain(secret);
  }
}

beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3001");
  A = await buyer("Alice Sigilosa Prado");
  B = await buyer("Beatriz Outra Lima");
  C = await createCustomerWithAnswers(db);
  customerIds.push(C.customerId);
  tokenA = await mintResultToken(db, A.orderId);
  tokenB = await mintResultToken(db, B.orderId);
});
beforeEach(() => {
  vi.stubEnv("APP_URL", "http://localhost:3001");
  vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "true");
  vi.stubEnv("PAYMENT_SIMULATION_FAIL", "false");
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => {
  vi.unstubAllEnvs();
});
afterAll(async () => {
  if (orderIds.length) await db.storage.from(DIAGNOSIS_BUCKET).remove(orderIds.map(diagnosisPdfPath));
  const cOrders = (await db.from("purchase_attempts").select("id").eq("customer_id", C.customerId)).data ?? [];
  if (cOrders.length) await db.from("orders").delete().in("attempt_id", cOrders.map((a) => a.id));
  if (orderIds.length) await db.from("orders").delete().in("id", orderIds);
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  await db.from("rate_limits").delete().or("key.like.resultlink:%,key.like.checkout:%,key.like.pdf:%,key.like.resendlink:%");
});

describe("another customer's identifiers return nothing", () => {
  it("the answers, checkout, payment check, result link, PDF and resend routes return nothing of another customer", async () => {
    // --- answers: the attempt comes from the cookie, never from the body.
    const bank = await loadQuestionBank(db);
    const question = bank.questions[0];
    const { data: aBefore } = await db.from("answers").select("alternative_id, answered_at").eq("attempt_id", A.attemptId).eq("question_id", question.id).single();
    const saved = await saveAnswerRoute(
      new Request("http://localhost/api/diagnostico/answers", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: cookieFor(C.attemptId) },
        body: JSON.stringify({ questionId: question.id, alternativeId: question.alternatives[1].id, attemptId: A.attemptId }),
      }),
    );
    expect(saved.status).toBe(200);
    const savedText = await saved.text();
    expectNothingOfA(savedText);
    const { data: aAfter } = await db.from("answers").select("alternative_id, answered_at").eq("attempt_id", A.attemptId).eq("question_id", question.id).single();
    expect(aAfter).toEqual(aBefore);
    const { data: cAnswer } = await db.from("answers").select("alternative_id").eq("attempt_id", C.attemptId).eq("question_id", question.id).single();
    expect(cAnswer!.alternative_id).toBe(question.alternatives[1].id);

    // --- the questionnaire page: C sees only C's saved answers.
    const page = await loadQuestionnaire(db, C.attemptId);
    const { data: cRows } = await db.from("answers").select("question_id, alternative_id").eq("attempt_id", C.attemptId);
    expect(page.answers).toEqual(Object.fromEntries((cRows ?? []).map((row) => [row.question_id, row.alternative_id])));
    expect(Object.values(page.answers)).toHaveLength(15);
    const pageText = JSON.stringify(page);
    expectNothingOfA(pageText);

    // --- checkout: the order belongs to C's attempt, whatever the body says.
    const checkout = await checkoutRoute(
      new Request("http://localhost/api/diagnostico/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookieFor(C.attemptId) },
        body: JSON.stringify({ attemptId: A.attemptId, orderId: A.orderId }),
      }),
    );
    expect([200, 201]).toContain(checkout.status);
    const checkoutBody = await checkout.json();
    expectNothingOfA(JSON.stringify(checkoutBody));
    const { data: cOrder } = await db.from("orders").select("attempt_id").eq("id", checkoutBody.orderId).single();
    expect(cOrder!.attempt_id).toBe(C.attemptId);

    // --- payment check: B's cookie reports B's order only; a visitor with a forged cookie gets a 403.
    const { gateway } = recordingGateway({ status: "PAID" });
    const checked = await handlePaymentCheck(
      new Request("http://localhost/api/diagnostico/payment/check", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookieFor(B.attemptId) },
        body: JSON.stringify({ orderId: A.orderId, attemptId: A.attemptId }),
      }),
      { gateway },
    );
    expect(checked.status).toBe(200);
    expectNothingOfA(await checked.text());
    const forged = await handlePaymentCheck(
      new Request("http://localhost/api/diagnostico/payment/check", { method: "POST", headers: { cookie: `${ATTEMPT_COOKIE}=${A.attemptId}.forged` } }),
      { gateway },
    );
    expect(forged.status).toBe(403);
    expectNothingOfA(await forged.text());

    // --- result link: B's cookie mints a link to B's order; C (no paid order) gets nothing.
    const linkB = await handleResultLink(new Request("http://localhost/api/diagnostico/result/link", { method: "POST", headers: { cookie: cookieFor(B.attemptId) } }));
    expect(linkB.status).toBe(200);
    const { path } = await linkB.json();
    const minted = await findResultToken(db, path.split("/").pop());
    expect(minted?.orderId).toBe(B.orderId);
    const linkC = await handleResultLink(new Request("http://localhost/api/diagnostico/result/link", { method: "POST", headers: { cookie: cookieFor(C.attemptId) } }));
    expect(linkC.status).toBe(409);
    expectNothingOfA(await linkC.text());

    // --- PDF: an invented token is a 404 with no data; B's token points to B's file only.
    const pdfRequest = (token: string) =>
      new Request("http://localhost/api/diagnostico/result/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
    const invented = await handleResultPdf(pdfRequest("i".repeat(43)));
    expect(invented.status).toBe(404);
    expectNothingOfA(await invented.text());
    const pdfB = await handleResultPdf(pdfRequest(tokenB));
    expect(pdfB.status).toBe(200);
    const { url } = await pdfB.json();
    expect(url).toContain(B.orderId);
    expect(url).not.toContain(A.orderId);

    // --- resend: the answer for A's e-mail is the neutral sentence and tells nothing about A.
    const provider = recordingEmailProvider();
    const resend = await handleResultResend(
      new Request("http://localhost/api/diagnostico/result/resend", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": randomIp() },
        body: JSON.stringify({ email: A.email }),
      }),
      { delivery: { provider: provider.provider } },
    );
    const resendText = await resend.text();
    expect(JSON.parse(resendText)).toEqual({ message: RESEND_NEUTRAL_MESSAGE });
    expectNothingOfA(resendText);
    // The only e-mail that went out went to A's own address, never to the requester.
    expect(provider.sent.every((message) => message.to === A.email)).toBe(true);
  });

  it("the result page shows B's diagnosis for B's token and never A's", async () => {
    const state = await loadResultByToken(db, tokenB);
    if (state.state !== "ready") throw new Error(`expected ready, got ${state.state}`);
    expect(state.orderId).toBe(B.orderId);
    expect(state.content.customer.firstName).toBe("Beatriz");
    expectNothingOfA(JSON.stringify(state));
    // A token that is not in the table opens nothing.
    expect((await loadResultByToken(db, "m".repeat(43))).state).toBe("invalid");
  });

  it("every cookie-based route refuses a forged cookie", async () => {
    const forged = `${ATTEMPT_COOKIE}=${A.attemptId}.0000`;
    const bank = await loadQuestionBank(db);
    const answers = await saveAnswerRoute(
      new Request("http://localhost/api/diagnostico/answers", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: forged },
        body: JSON.stringify({ questionId: bank.questions[0].id, alternativeId: bank.questions[0].alternatives[0].id }),
      }),
    );
    const checkout = await checkoutRoute(new Request("http://localhost/api/diagnostico/checkout", { method: "POST", headers: { cookie: forged } }));
    const link = await handleResultLink(new Request("http://localhost/api/diagnostico/result/link", { method: "POST", headers: { cookie: forged } }));
    for (const response of [answers, checkout, link]) {
      expect(response.status).toBe(403);
      expectNothingOfA(await response.text());
    }
  });
});
