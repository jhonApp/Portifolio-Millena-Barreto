import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { STYLES } from "@/lib/diagnostico/constants";
import { diagnosisContentSchema } from "@/lib/diagnostico/schemas/diagnosis-content";
import { downloadDiagnosisPdf, diagnosisPdfPath, DIAGNOSIS_BUCKET } from "@/lib/diagnostico/diagnosis-storage";
import { generateDiagnosis, reprocessOrder, type GenerationDeps } from "@/lib/diagnostico/generation";
import { OrderNotApprovedError } from "@/lib/diagnostico/order-guard";
import { loadQuestionBank } from "@/lib/diagnostico/question-bank";
import { scoreAnswers } from "@/lib/diagnostico/scoring";
import { adminClient, createApprovedOrder, createAttempt, createCustomer, createOrderWithPayment, readPdf } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const orderIds: string[] = [];

async function newOrder(options: Parameters<typeof createApprovedOrder>[1] = {}) {
  const created = await createApprovedOrder(db, options);
  customerIds.push(created.customerId);
  orderIds.push(created.orderId);
  return created;
}

// Letter-spaced headings come out of the text reader with spaces between letters: compare without them.
const compact = (text: string) => text.toLowerCase().replace(/\s+/g, "");

const fakePdf = async () => new TextEncoder().encode("%PDF-1.4 fake");
const okDeps = (extra: GenerationDeps = {}): GenerationDeps => ({ renderPdf: fakePdf, onDiagnosisReady: async () => {}, ...extra });

async function orderRow(orderId: string) {
  const { data } = await db.from("orders").select("*").eq("id", orderId).single();
  return data!;
}
async function results(orderId: string) {
  const { data } = await db.from("results").select("*").eq("order_id", orderId);
  return data ?? [];
}
async function errorSteps(orderId: string) {
  const { data } = await db.from("automation_errors").select("step, context").eq("order_id", orderId);
  return data ?? [];
}
async function filesFor(orderId: string) {
  const { data } = await db.storage.from(DIAGNOSIS_BUCKET).list("", { search: orderId });
  return (data ?? []).filter((file) => file.name === diagnosisPdfPath(orderId));
}
async function makeDue(orderId: string) {
  await db.from("orders").update({ generation_next_at: new Date(Date.now() - 1000).toISOString() }).eq("id", orderId);
}

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (orderIds.length) {
    await db.storage.from(DIAGNOSIS_BUCKET).remove(orderIds.map(diagnosisPdfPath));
    await db.from("automation_errors").delete().in("order_id", orderIds);
  }
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
});

describe("generateDiagnosis", () => {
  it("an approved order is generated: PROCESSING, six scores, both styles saved and the PDF stored", async () => {
    const { orderId, name } = await newOrder({ name: "Maria Souza Lima" });
    const outcome = await generateDiagnosis(db, orderId, { token: "plain-token" }); // real renderer and storage

    expect(outcome).toEqual({ result: "generated", orderId });
    const order = await orderRow(orderId);
    expect(order.status).toBe("PROCESSING");
    expect(order.generation_next_at).toBeNull();

    const [result] = await results(orderId);
    expect(Object.keys(result.points as object).sort()).toEqual([...STYLES].sort());
    expect(STYLES).toContain(result.predominant_style);
    expect(STYLES).toContain(result.secondary_style);
    expect(result.predominant_style).not.toBe(result.secondary_style);
    expect(result.pdf_path).toBe(diagnosisPdfPath(orderId));
    expect(diagnosisContentSchema.safeParse(result.content).success).toBe(true);

    const bytes = await downloadDiagnosisPdf(db, orderId);
    expect(bytes).not.toBeNull();
    const pdf = await readPdf(bytes!);
    expect(compact(pdf.pages[0])).toContain(compact(name));
  });

  it("the stored file is the PDF of the order", async () => {
    const first = await newOrder({ name: "Ana Paula Ribeiro" });
    const second = await newOrder({ name: "Beatriz Campos Neves" });
    await generateDiagnosis(db, first.orderId);
    await generateDiagnosis(db, second.orderId);
    const a = await readPdf((await downloadDiagnosisPdf(db, first.orderId))!);
    const b = await readPdf((await downloadDiagnosisPdf(db, second.orderId))!);
    console.log("COVER_A", JSON.stringify(a.pages[0]), "COVER_B", JSON.stringify(b.pages[0]));
    expect(compact(a.pages[0])).toContain(compact("Ana Paula Ribeiro"));
    expect(compact(a.pages[0])).not.toContain("beatriz");
    expect(compact(b.pages[0])).toContain(compact("Beatriz Campos Neves"));
  });

  it("results is not inserted before the PDF exists", async () => {
    const { orderId } = await newOrder();
    const seen: number[] = [];
    const uploadPdf = async (_db: unknown, id: string) => {
      seen.push((await results(id)).length); // no result may exist while the upload runs
      throw new Error("storage down");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const outcome = await generateDiagnosis(db, orderId, { deps: okDeps({ uploadPdf }) });
    expect(outcome.result).toBe("retry_scheduled");
    expect(seen).toEqual([0]);
    expect(await results(orderId)).toHaveLength(0);
  });

  it("the order score matches the scoring engine on the same answers", async () => {
    const bank = await loadQuestionBank(db);
    const choose = (position: number) => (position * 7) % 4;
    const { orderId } = await newOrder({ choose });
    await generateDiagnosis(db, orderId, { deps: okDeps() });
    const expected = scoreAnswers(
      bank.questions.map((q) => {
        const alt = q.alternatives[choose(q.position) % q.alternatives.length];
        return { questionPosition: q.position, style: alt.style, weight: alt.weight };
      }),
    );
    const [result] = await results(orderId);
    expect(result.points).toEqual(expected.points);
    expect(result.predominant_style).toBe(expected.predominant);
    expect(result.secondary_style).toBe(expected.secondary);
  });

  it("two customers with the same pair get different diagnoses", async () => {
    const bank = await loadQuestionBank(db);
    const candidates = Array.from({ length: 80 }, (_, seed) => {
      const choose = (position: number) => Math.floor(((position * 2654435761 + seed * 40503) >>> 0) / 7) % 4;
      const scored = scoreAnswers(
        bank.questions.map((q) => {
          const alt = q.alternatives[choose(q.position) % q.alternatives.length];
          return { questionPosition: q.position, style: alt.style, weight: alt.weight };
        }),
      );
      return { choose, scored };
    });
    let pair: [(typeof candidates)[number], (typeof candidates)[number]] | null = null;
    for (const a of candidates) {
      const b = candidates.find(
        (c) =>
          c !== a &&
          c.scored.predominant === a.scored.predominant &&
          c.scored.secondary === a.scored.secondary &&
          JSON.stringify(c.scored.points) !== JSON.stringify(a.scored.points),
      );
      if (b) {
        pair = [a, b];
        break;
      }
    }
    expect(pair, "no two answer sets share a pair with different points").not.toBeNull();

    const first = await newOrder({ choose: pair![0].choose });
    const second = await newOrder({ choose: pair![1].choose });
    await generateDiagnosis(db, first.orderId, { deps: okDeps() });
    await generateDiagnosis(db, second.orderId, { deps: okDeps() });
    const [a] = await results(first.orderId);
    const [b] = await results(second.orderId);
    const ca = a.content as unknown as { percentages: object; blocks: { items?: string[] }[] };
    const cb = b.content as unknown as { percentages: object; blocks: { items?: string[] }[] };
    expect(a.predominant_style).toBe(b.predominant_style);
    expect(a.secondary_style).toBe(b.secondary_style);
    expect(ca.percentages).not.toEqual(cb.percentages);
    expect([ca.blocks[1].items, ca.blocks[2].items]).not.toEqual([cb.blocks[1].items, cb.blocks[2].items]);
  });
});

describe("idempotency and recovery", () => {
  it("generating twice leaves one result and one PDF", async () => {
    const { orderId } = await newOrder();
    const first = await generateDiagnosis(db, orderId);
    const second = await generateDiagnosis(db, orderId);
    expect(first.result).toBe("generated");
    expect(second.result).toBe("already_generated");
    expect(await results(orderId)).toHaveLength(1);
    expect(await filesFor(orderId)).toHaveLength(1);
  });

  it("two overlapping runs generate once", async () => {
    const { orderId } = await newOrder();
    let renders = 0;
    const renderPdf = async () => {
      renders += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return fakePdf();
    };
    const outcomes = await Promise.all([
      generateDiagnosis(db, orderId, { deps: okDeps({ renderPdf }) }),
      generateDiagnosis(db, orderId, { deps: okDeps({ renderPdf }) }),
    ]);
    expect(outcomes.map((o) => o.result).sort()).toEqual(["generated", "not_claimed"]);
    expect(renders).toBe(1);
    expect(await results(orderId)).toHaveLength(1);
  });

  it("a crash between upload and insert is recovered without a second result", async () => {
    const { orderId } = await newOrder();
    // The upload succeeded but the process died before the insert: file present, no result, lease expired.
    await db.storage.from(DIAGNOSIS_BUCKET).upload(diagnosisPdfPath(orderId), new TextEncoder().encode("%PDF-1.4 old"), {
      contentType: "application/pdf",
      upsert: true,
    });
    await db.from("orders").update({ status: "PROCESSING", generation_attempts: 1, generation_next_at: new Date(Date.now() - 1000).toISOString() }).eq("id", orderId);

    const outcome = await generateDiagnosis(db, orderId, { deps: okDeps() });
    expect(outcome.result).toBe("generated");
    expect(await results(orderId)).toHaveLength(1);
    expect(await filesFor(orderId)).toHaveLength(1);
    expect((await orderRow(orderId)).generation_attempts).toBe(2);
  });
});

describe("failures and retries", () => {
  it("a rendering failure schedules a retry in 30 seconds", async () => {
    const { orderId } = await newOrder();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const outcome = await generateDiagnosis(db, orderId, {
      deps: okDeps({ renderPdf: async () => { throw new Error("render boom"); } }),
    });
    expect(outcome.result).toBe("retry_scheduled");
    const seconds = (new Date((outcome as { nextAt: string }).nextAt).getTime() - Date.now()) / 1000;
    expect(seconds).toBeGreaterThan(25);
    expect(seconds).toBeLessThanOrEqual(31);
    expect((await orderRow(orderId)).status).toBe("PROCESSING");
    expect((await errorSteps(orderId)).map((e) => e.step)).toContain("RENDER_PDF");
  });

  it("the retries are scheduled at 30 seconds 2 minutes and 10 minutes", async () => {
    const { orderId } = await newOrder();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = okDeps({ renderPdf: async () => { throw new Error("render boom"); } });
    const expected = [30, 120, 600];
    for (const delay of expected) {
      const outcome = await generateDiagnosis(db, orderId, { deps });
      expect(outcome.result).toBe("retry_scheduled");
      const seconds = (new Date((outcome as { nextAt: string }).nextAt).getTime() - Date.now()) / 1000;
      expect(seconds).toBeGreaterThan(delay - 5);
      expect(seconds).toBeLessThanOrEqual(delay + 1);
      await makeDue(orderId);
    }
  });

  it("after the third retry the order is FAILED with GENERATION_FAILED and an automation error", async () => {
    const { orderId } = await newOrder();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = okDeps({ renderPdf: async () => { throw new Error("render boom"); } });
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect((await generateDiagnosis(db, orderId, { deps })).result).toBe("retry_scheduled");
      await makeDue(orderId);
    }
    const last = await generateDiagnosis(db, orderId, { deps });
    expect(last).toEqual({ result: "failed", orderId, reason: "GENERATION_FAILED" });
    expect(await orderRow(orderId)).toMatchObject({ status: "FAILED", failure_reason: "GENERATION_FAILED" });
    expect((await errorSteps(orderId)).map((e) => e.step)).toContain("GENERATION_FAILED");
    expect(await results(orderId)).toHaveLength(0);
  });

  it("a storage failure is retried like a rendering failure", async () => {
    const { orderId } = await newOrder();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const outcome = await generateDiagnosis(db, orderId, {
      deps: okDeps({ uploadPdf: async () => { throw new Error("storage down"); } }),
    });
    expect(outcome.result).toBe("retry_scheduled");
    expect((await errorSteps(orderId)).map((e) => e.step)).toContain("UPLOAD_PDF");
  });

  it("an unexpected error is retried", async () => {
    const { orderId } = await newOrder();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const outcome = await generateDiagnosis(db, orderId, {
      deps: okDeps({ renderPdf: async () => { throw new TypeError("surprise"); } }),
    });
    expect(outcome.result).toBe("retry_scheduled");
  });

  it("a missing template stops with MISSING_CONTENT without retries and records the error", async () => {
    const { orderId } = await newOrder();
    const { data: version } = await db.from("content_versions").select("id").eq("status", "published").single();
    const { data: saved } = await db.from("content_templates").select("*").eq("version_id", version!.id).eq("kind", "pair_paragraph");
    await db.from("content_templates").delete().eq("version_id", version!.id).eq("kind", "pair_paragraph");
    try {
      const outcome = await generateDiagnosis(db, orderId, { deps: okDeps() });
      expect(outcome).toEqual({ result: "failed", orderId, reason: "MISSING_CONTENT" });
      expect(await orderRow(orderId)).toMatchObject({ status: "FAILED", failure_reason: "MISSING_CONTENT", generation_attempts: 1 });
      const errors = await errorSteps(orderId);
      expect(errors.map((e) => e.step)).toContain("LOAD_CONTENT");
      expect(JSON.stringify(errors)).not.toContain("Maria"); // no personal data
    } finally {
      await db.from("content_templates").insert(saved!.map(({ id: _id, created_at: _c, updated_at: _u, ...row }) => row));
    }
  });

  it("fixing the template and reprocessing completes the order", async () => {
    const { orderId } = await newOrder();
    const { data: version } = await db.from("content_versions").select("id").eq("status", "published").single();
    const { data: saved } = await db.from("content_templates").select("*").eq("version_id", version!.id).eq("kind", "pair_paragraph");
    await db.from("content_templates").delete().eq("version_id", version!.id).eq("kind", "pair_paragraph");
    try {
      expect((await generateDiagnosis(db, orderId, { deps: okDeps() })).result).toBe("failed");
    } finally {
      await db.from("content_templates").insert(saved!.map(({ id: _id, created_at: _c, updated_at: _u, ...row }) => row));
    }
    const outcome = await reprocessOrder(db, orderId, { deps: okDeps() });
    expect(outcome.result).toBe("generated");
    expect((await orderRow(orderId)).status).toBe("PROCESSING");
    expect(await results(orderId)).toHaveLength(1);
  });

  it("fewer than 15 answers stops with INVALID_ANSWERS without retries", async () => {
    const { orderId } = await newOrder({ answers: 14 });
    const outcome = await generateDiagnosis(db, orderId, { deps: okDeps() });
    expect(outcome).toEqual({ result: "failed", orderId, reason: "INVALID_ANSWERS" });
    expect(await orderRow(orderId)).toMatchObject({ status: "FAILED", failure_reason: "INVALID_ANSWERS" });
    expect((await errorSteps(orderId)).map((e) => e.step)).toContain("SCORE_ANSWERS");
  });

  it("reprocessOrder refuses an order that did not fail in generation", async () => {
    const { orderId } = await newOrder();
    expect((await reprocessOrder(db, orderId, { deps: okDeps() })).result).toBe("not_claimed");
  });

  it("reprocessOrder runs the generation once for a failed paid order", async () => {
    const { orderId } = await newOrder();
    await db.from("orders").update({ status: "FAILED", failure_reason: "GENERATION_FAILED", generation_attempts: 4 }).eq("id", orderId);
    expect((await reprocessOrder(db, orderId, { deps: okDeps() })).result).toBe("generated");
    expect(await results(orderId)).toHaveLength(1);
  });
});

describe("hooks and guards", () => {
  it("onDiagnosisReady receives the plain token on the first attempt and null on a retry", async () => {
    const first = await newOrder();
    const calls: (string | null)[] = [];
    const onDiagnosisReady = async (_id: string, token: string | null) => {
      calls.push(token);
    };
    await generateDiagnosis(db, first.orderId, { token: "plain-token", deps: okDeps({ onDiagnosisReady }) });

    const second = await newOrder();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await generateDiagnosis(db, second.orderId, {
      token: "plain-token",
      deps: okDeps({ renderPdf: async () => { throw new Error("boom"); } }),
    });
    await makeDue(second.orderId);
    await generateDiagnosis(db, second.orderId, { token: null, deps: okDeps({ onDiagnosisReady }) });
    expect(calls).toEqual(["plain-token", null]);
  });

  it("a hook failure is recorded and the result stays", async () => {
    const { orderId } = await newOrder();
    const outcome = await generateDiagnosis(db, orderId, {
      deps: okDeps({ onDiagnosisReady: async () => { throw new Error("hook boom"); } }),
    });
    expect(outcome.result).toBe("generated");
    expect(await results(orderId)).toHaveLength(1);
    expect((await errorSteps(orderId)).map((e) => e.step)).toContain("DIAGNOSIS_READY");
  });

  it("the order stays PROCESSING after success", async () => {
    const { orderId } = await newOrder();
    await generateDiagnosis(db, orderId, { deps: okDeps() });
    expect((await orderRow(orderId)).status).toBe("PROCESSING");
  });

  it("generateDiagnosis refuses a FAILED order that was never paid", async () => {
    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    const attempt = await createAttempt(db, customer.id);
    const { order } = await createOrderWithPayment(db, attempt.id, "FAILED");
    orderIds.push(order.id);
    await expect(generateDiagnosis(db, order.id, { deps: okDeps() })).rejects.toBeInstanceOf(OrderNotApprovedError);
    expect(await results(order.id)).toHaveLength(0);
  });

  it("no personal data in automation error context", async () => {
    const { orderId } = await newOrder({ name: "Fulana Pessoal Sigilosa" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await generateDiagnosis(db, orderId, { deps: okDeps({ renderPdf: async () => { throw new Error("render boom"); } }) });
    const errors = JSON.stringify(await errorSteps(orderId));
    expect(errors).not.toContain("Fulana");
    expect(errors).not.toContain("@example.com");
  });
});
