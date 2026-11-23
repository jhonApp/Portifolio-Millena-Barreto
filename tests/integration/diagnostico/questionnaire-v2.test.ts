import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { saveAnswer } from "@/lib/diagnostico/answers";
import { STYLES } from "@/lib/diagnostico/constants";
import * as questionBank from "@/lib/diagnostico/question-bank";
import {
  QuestionBankError,
  getPublicQuestionSet,
  getScoredAnswers,
  getScoringRules,
  loadQuestionBank,
  publishQuestionnaireVersion,
  updateAlternativeText,
  updateQuestionText,
} from "@/lib/diagnostico/question-bank";
import { validateQuestionSet } from "@/lib/diagnostico/question-set-rules";
import { loadQuestionnaire, loadQuestionnairePage } from "@/lib/diagnostico/questionnaire-page";
import { scoreAnswers } from "@/lib/diagnostico/scoring";
import { type StepSpec, version2Steps } from "../../support/version2-set";
import {
  adminClient,
  createAttempt,
  createCustomer,
  createFullVersion,
  createVersionFromSteps,
  deleteVersions,
  publishVersionTemporarily,
} from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const createdVersionIds: string[] = [];
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function versionByNumber(version: number) {
  const { data, error } = await db.from("questionnaire_versions").select("*").eq("version", version).single();
  if (error) throw new Error(error.message);
  return data;
}

/** The questions of a version with their alternatives, in position order. */
async function loadSteps(versionId: string) {
  const { data: questions } = await db.from("questions").select("*").eq("version_id", versionId).order("position");
  const { data: alternatives } = await db
    .from("alternatives")
    .select("*")
    .in("question_id", (questions ?? []).map((question) => question.id))
    .order("position");
  return (questions ?? []).map((question) => ({
    ...question,
    alternatives: (alternatives ?? []).filter((alternative) => alternative.question_id === question.id),
  }));
}

async function publishedVersions() {
  const { data } = await db.from("questionnaire_versions").select("version").eq("status", "published");
  return (data ?? []).map((row) => row.version);
}

/** Inserts a draft version with the given structure (version 2 rules). Deleted in afterAll. */
async function insertSet(steps: StepSpec[]) {
  const version = await createVersionFromSteps(db, steps);
  createdVersionIds.push(version.id);
  return version;
}

/** Puts the published version back as it was, whatever a test did to the statuses. */
async function snapshotPublished() {
  const { data } = await db.from("questionnaire_versions").select("id, published_at").eq("status", "published").single();
  return async () => {
    await db.from("questionnaire_versions").update({ status: "archived" }).eq("status", "published");
    await db.from("questionnaire_versions").update({ status: "published", published_at: data!.published_at }).eq("id", data!.id);
  };
}

async function sqlIssue(versionId: string): Promise<string | null> {
  const { data, error } = await db.rpc("questionnaire_set_issue", { p_version: versionId });
  if (error) throw new Error(error.message);
  return data;
}

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  await deleteVersions(db, createdVersionIds);
  // Safety net: the shared database must end with version 1 published and version 2 a draft.
  expect(await publishedVersions()).toEqual([1]);
  expect((await versionByNumber(2)).status).toBe("draft");
});

// Version 1 questions copied to version 2 and the step they take.
const COPIED = [
  [2, 1], [3, 2], [4, 3], [6, 4], [7, 6], [8, 7], [9, 8], [10, 9], [11, 11], [12, 12], [13, 13], [15, 14],
] as const;
const DUELS = [
  { position: 5, chapter: 1, styles: ["esportivo_natural", "elegante"] },
  { position: 10, chapter: 2, styles: ["tradicional", "criativo"] },
  { position: 15, chapter: 3, styles: ["romantico", "dramatico"] },
];

describe("the seeded version 2", () => {
  it("has 12 questions, 3 duels and 9 steps per style", async () => {
    const version = await versionByNumber(2);
    expect(version).toMatchObject({ first_choice_points: 2, second_choice_points: 1, late_tiebreak_basis: "points" });
    const steps = await loadSteps(version.id);
    expect(steps.map((step) => step.position)).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));

    const regular = steps.filter((step) => step.kind === "choice");
    const duels = steps.filter((step) => step.kind === "duel");
    expect(regular).toHaveLength(12);
    expect(duels.map((step) => step.position)).toEqual([5, 10, 15]);
    for (const step of regular) {
      expect(step.max_choices).toBe(2);
      expect(step.alternatives).toHaveLength(4);
      expect(new Set(step.alternatives.map((alternative) => alternative.style)).size).toBe(4);
    }
    for (const duel of duels) {
      expect(duel.max_choices).toBe(1);
      expect(duel.alternatives).toHaveLength(2);
      expect(duel.alternatives.map((alternative) => alternative.text)).toEqual(["Look A", "Look B"]);
      expect(duel.alternatives.every((alternative) => alternative.weight === 1)).toBe(true);
    }

    // Every style appears in exactly 9 steps and in exactly one duel.
    for (const style of STYLES) {
      const inSteps = steps.filter((step) => step.alternatives.some((alternative) => alternative.style === style));
      expect(inSteps, style).toHaveLength(9);
      expect(duels.filter((duel) => duel.alternatives.some((alternative) => alternative.style === style)), style).toHaveLength(1);
    }

    // Three chapters of five steps.
    for (const chapter of [1, 2, 3]) {
      expect(steps.filter((step) => step.chapter === chapter)).toHaveLength(5);
    }
    for (const step of steps) expect(step.chapter).toBe(Math.ceil(step.position / 5));
  });

  it("copies the mapping of the version 1 questions it carries over and adds the three duels", async () => {
    const v1 = await loadSteps((await versionByNumber(1)).id);
    const v2 = await loadSteps((await versionByNumber(2)).id);
    for (const [from, to] of COPIED) {
      const source = v1.find((step) => step.position === from)!;
      const copy = v2.find((step) => step.position === to)!;
      const shape = (step: typeof source) => step.alternatives.map((a) => [a.position, a.style, a.weight]);
      expect(shape(copy), `step ${to}`).toEqual(shape(source));
      expect(copy.text.length).toBeGreaterThan(0);
    }
    for (const duel of DUELS) {
      const step = v2.find((candidate) => candidate.position === duel.position)!;
      expect(step.chapter).toBe(duel.chapter);
      expect(step.alternatives.map((alternative) => alternative.style)).toEqual(duel.styles);
    }
  });

  it("does not change version 1", async () => {
    const v1 = await versionByNumber(1);
    expect(v1).toMatchObject({ first_choice_points: 1, second_choice_points: 0, late_tiebreak_basis: "answers" });
    const steps = await loadSteps(v1.id);
    expect(steps).toHaveLength(15);
    expect(steps.every((step) => step.kind === "choice" && step.max_choices === 1 && step.chapter === null)).toBe(true);
  });

  it("the database refuses a duel that allows two choices", async () => {
    const version = await versionByNumber(2);
    const duel = (await loadSteps(version.id)).find((step) => step.kind === "duel")!;
    const { error } = await db.from("questions").update({ max_choices: 2 }).eq("id", duel.id);
    expect(error?.message).toContain("questions_duel_single_choice");
  });
});

describe("the public set of version 2", () => {
  it("has no style or weight", async () => {
    const v2 = await versionByNumber(2);
    const set = await getPublicQuestionSet(db, "seed-privacy", v2.id);
    expect(set).toMatchObject({ versionId: v2.id, version: 2 });
    expect(set.questions).toHaveLength(15);
    for (const question of set.questions) {
      expect(Object.keys(question).sort()).toEqual(["alternatives", "chapter", "id", "kind", "maxChoices", "position", "text"]);
      for (const alternative of question.alternatives) expect(Object.keys(alternative).sort()).toEqual(["id", "text"]);
    }
    expect(set.questions.filter((question) => question.kind === "duel").map((question) => question.position)).toEqual([5, 10, 15]);
    expect(set.questions.map((question) => question.chapter)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
    // No style or weight key anywhere (alternative texts may use a style word, so only keys are checked).
    const json = JSON.stringify(set);
    expect(json).not.toContain('"weight"');
    expect(json).not.toContain('"style"');  });

  it("keeps the order of alternatives and duel looks stable for the same attempt", async () => {
    const v2 = await versionByNumber(2);
    const first = await getPublicQuestionSet(db, "attempt-seed-1", v2.id);
    const second = await getPublicQuestionSet(db, "attempt-seed-1", v2.id);
    expect(second).toEqual(first);
    const duel = first.questions.find((question) => question.kind === "duel")!;
    expect(duel.alternatives.map((alternative) => alternative.text).sort()).toEqual(["Look A", "Look B"]);
    // Another attempt may get another order, but every step still has the same alternatives.
    const other = await getPublicQuestionSet(db, "attempt-seed-2", v2.id);
    for (const question of first.questions) {
      const twin = other.questions.find((candidate) => candidate.id === question.id)!;
      expect(twin.alternatives.map((alternative) => alternative.id).sort()).toEqual(
        question.alternatives.map((alternative) => alternative.id).sort(),
      );
    }
  });
});

describe("publishing", () => {
  it("is atomic: exactly one version is published afterwards", async () => {
    const v2 = await versionByNumber(2);
    await publishVersionTemporarily(db, v2.id, async () => {
      expect(await publishedVersions()).toEqual([2]);
      const v1 = await versionByNumber(1);
      expect(v1.status).toBe("archived");
      const published = await versionByNumber(2);
      expect(published.status).toBe("published");
      expect(published.published_at).not.toBeNull();
    });
    // Restored: version 1 published again, version 2 a draft.
    expect(await publishedVersions()).toEqual([1]);
    expect((await versionByNumber(2)).status).toBe("draft");
  });

  it("two publications at once leave exactly one version published", async () => {
    const restore = await snapshotPublished();
    try {
      const a = await insertSet(version2Steps());
      const b = await insertSet(version2Steps());
      const results = await Promise.allSettled([
        publishQuestionnaireVersion(db, a.id),
        publishQuestionnaireVersion(db, b.id),
      ]);
      expect(results.every((result) => result.status === "fulfilled")).toBe(true);
      const published = await publishedVersions();
      expect(published).toHaveLength(1);
      expect([a.version, b.version]).toContain(published[0]);
    } finally {
      await restore();
    }
  });

  it("publishing an unbalanced draft is refused and the live version stays", async () => {
    const steps = version2Steps();
    const step = steps[0];
    const removed = step.styles[0];
    step.styles[0] = STYLES.find((style) => !step.styles.includes(style))!;
    const draft = await insertSet(steps);

    const error = await publishQuestionnaireVersion(db, draft.id).catch((caught) => caught);
    expect(error).toBeInstanceOf(QuestionBankError);
    expect(error.code).toBe("INVALID_SET");
    expect(error.issues.map((issue: { message: string }) => issue.message).join(" ")).toContain(removed);

    // The database refuses it too, with the rule and the style in the message.
    const { error: sqlError } = await db.rpc("publish_questionnaire_version", { p_version: draft.id });
    expect(sqlError?.message).toMatch(/^INVALID_SET: STYLE_BALANCE: [a-z_]+ appears in (8|10) steps, expected 9$/);

    expect(await publishedVersions()).toEqual([1]);
    expect((await versionByNumber(draft.version)).status).toBe("draft");
  });

  it("publishing twice and an unknown version fail with their codes", async () => {
    const draft = await insertSet(version2Steps());
    await publishVersionTemporarily(db, draft.id, async () => {
      await expect(publishQuestionnaireVersion(db, draft.id)).rejects.toMatchObject({ code: "VERSION_ALREADY_PUBLISHED" });
      const { error } = await db.rpc("publish_questionnaire_version", { p_version: draft.id });
      expect(error?.message).toContain("VERSION_ALREADY_PUBLISHED");
    });
    await expect(publishQuestionnaireVersion(db, UNKNOWN_ID)).rejects.toMatchObject({ code: "VERSION_NOT_FOUND" });
    const { error } = await db.rpc("publish_questionnaire_version", { p_version: UNKNOWN_ID });
    expect(error?.message).toContain("VERSION_NOT_FOUND");
  });

  it("version 1 can be published again as a rollback", async () => {
    const draft = await insertSet(version2Steps());
    const v1 = await versionByNumber(1);
    await publishVersionTemporarily(db, draft.id, async () => {
      expect(await publishedVersions()).toEqual([draft.version]);
      const result = await publishQuestionnaireVersion(db, v1.id);
      expect(result).toEqual({ published: 1, archived: draft.version });
      expect(await publishedVersions()).toEqual([1]);
    });
    expect(await publishedVersions()).toEqual([1]);
  });
});

describe("the SQL and TypeScript validators", () => {
  it("agree on valid and broken fixtures", async () => {
    const cases: Record<string, (steps: StepSpec[]) => StepSpec[]> = {
      valid: (steps) => steps,
      "a style in 8 steps": (steps) => {
        steps[0].styles[0] = STYLES.find((style) => !steps[0].styles.includes(style))!;
        return steps;
      },
      "a duel at step 4": (steps) => {
        steps[4] = { ...steps[4], kind: "choice", styles: [...STYLES.slice(0, 4)] };
        steps[3] = { ...steps[3], kind: "duel", styles: [...STYLES.slice(0, 2)] };
        return steps;
      },
      "two duels": (steps) => {
        steps[14] = { ...steps[14], kind: "choice", styles: [...STYLES.slice(0, 4)] };
        return steps;
      },
      "a chapter of 4 steps": (steps) => {
        steps[0].chapter = 2;
        return steps;
      },
      "a style in two duels": (steps) => {
        steps[9].styles = ["esportivo_natural", "criativo"];
        return steps;
      },
      "a duel with one alternative": (steps) => {
        steps[4].styles = [steps[4].styles[0]];
        return steps;
      },
      "14 steps": (steps) => steps.slice(0, 14),
    };
    for (const [name, mutate] of Object.entries(cases)) {
      const draft = await insertSet(mutate(version2Steps()));
      const issues = validateQuestionSet(await loadQuestionBank(db, draft.id));
      const issue = await sqlIssue(draft.id);
      expect(issue === null, `${name}: SQL says ${issue}`).toBe(issues.length === 0);
      if (issue !== null) expect(issues.map((candidate) => candidate.code), name).toContain(issue.split(":")[0]);
    }

    // Version 1 profile: the real version 1 is valid for both; a 15 x 4 set with 4 styles is not.
    const v1 = await versionByNumber(1);
    expect(await sqlIssue(v1.id)).toBeNull();
    expect(validateQuestionSet(await loadQuestionBank(db, v1.id))).toEqual([]);
    const unbalanced = await createFullVersion(db, "archived");
    createdVersionIds.push(unbalanced.version.id);
    expect(await sqlIssue(unbalanced.version.id)).toMatch(/^STYLE_IMBALANCE/);
    expect(validateQuestionSet(await loadQuestionBank(db, unbalanced.version.id)).map((issue) => issue.code)).toContain(
      "STYLE_IMBALANCE",
    );
  });
});

describe("editing the texts of a draft", () => {
  it("an edited alternative text is shown after publishing and its style and weight are unchanged", async () => {
    const draft = await insertSet(version2Steps());
    const before = await loadQuestionBank(db, draft.id);
    const target = before.questions[1].alternatives[2];
    await updateAlternativeText(db, target.id, "  Texto revisado pela Millena.  ");
    await updateQuestionText(db, before.questions[1].id, "Pergunta revisada?");

    await publishVersionTemporarily(db, draft.id, async () => {
      const served = await getPublicQuestionSet(db, "any-attempt");
      expect(served.version).toBe(draft.version);
      const question = served.questions[1];
      expect(question.text).toBe("Pergunta revisada?");
      expect(question.alternatives.find((alternative) => alternative.id === target.id)?.text).toBe("Texto revisado pela Millena.");
    });

    const after = await loadQuestionBank(db, draft.id);
    expect(after.questions[1].alternatives[2]).toMatchObject({
      id: target.id,
      text: "Texto revisado pela Millena.",
      style: target.style,
      weight: target.weight,
      position: target.position,
    });
    const mapping = (set: typeof before) =>
      set.questions.map((question) => question.alternatives.map((alternative) => [alternative.style, alternative.weight, alternative.position]));
    expect(mapping(after)).toEqual(mapping(before));
  });

  it("the edit functions change text only and refuse a published version", async () => {
    const draft = await insertSet(version2Steps());
    const bank = await loadQuestionBank(db, draft.id);
    const alternativeId = bank.questions[0].alternatives[0].id;
    const questionId = bank.questions[0].id;

    await expect(updateAlternativeText(db, alternativeId, "   ")).rejects.toMatchObject({ code: "INVALID_TEXT" });
    await expect(updateQuestionText(db, questionId, "x".repeat(301))).rejects.toMatchObject({ code: "INVALID_TEXT" });
    await expect(updateQuestionText(db, UNKNOWN_ID, "ok")).rejects.toMatchObject({ code: "NOT_FOUND" });

    await publishVersionTemporarily(db, draft.id, async () => {
      await expect(updateAlternativeText(db, alternativeId, "novo texto")).rejects.toMatchObject({ code: "VERSION_NOT_DRAFT" });
      await expect(updateQuestionText(db, questionId, "nova pergunta")).rejects.toMatchObject({ code: "VERSION_NOT_DRAFT" });
    });
    const unchanged = await loadQuestionBank(db, draft.id);
    expect(unchanged.questions[0].text).toBe(bank.questions[0].text);
    expect(unchanged.questions[0].alternatives[0].text).toBe(bank.questions[0].alternatives[0].text);

    // Version 1 (archived or published) is never editable either.
    const v1 = await loadQuestionBank(db, (await versionByNumber(1)).id);
    await expect(updateQuestionText(db, v1.questions[0].id, "novo")).rejects.toMatchObject({ code: "VERSION_NOT_DRAFT" });
  });

  it("there is no function that changes style, weight, kind, chapter or position", () => {
    const editors = Object.keys(questionBank).filter((name) => /^(update|set|change|move|reorder|delete|remove)/i.test(name));
    expect(editors.sort()).toEqual(["updateAlternativeText", "updateQuestionText"]);
    // Both take (db, id, text): there is nowhere to pass another field.
    expect(questionBank.updateAlternativeText.length).toBe(3);
    expect(questionBank.updateQuestionText.length).toBe(3);
  });
});

async function newAttempt() {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  return createAttempt(db, customer.id);
}

describe("version routing", () => {
  it("a new attempt is served version 2 with 15 steps in 3 chapters of 5", async () => {
    const v2 = await versionByNumber(2);
    const attempt = await newAttempt();
    await publishVersionTemporarily(db, v2.id, async () => {
      const state = await loadQuestionnaire(db, attempt.id);
      expect(state.questionSet.version).toBe(2);
      expect(state.questionSet.questions).toHaveLength(15);
      for (const chapter of [1, 2, 3]) {
        expect(state.questionSet.questions.filter((question) => question.chapter === chapter)).toHaveLength(5);
      }
      expect(state.questionSet.questions.filter((question) => question.kind === "duel").map((question) => question.position)).toEqual([5, 10, 15]);
      expect(state.startIndex).toBe(0);
      expect(state.choices).toEqual({});
      const first = (await loadSteps(v2.id))[0];
      expect(state.questionSet.questions[0].text).toBe(first.text);
    });
  });

  it("an attempt with answers keeps its own version after the release", async () => {
    const v1 = await loadQuestionBank(db, (await versionByNumber(1)).id);
    const attempt = await newAttempt();
    for (const question of v1.questions.slice(0, 3)) {
      await saveAnswer(db, attempt.id, question.id, question.alternatives[0].id);
    }
    const v2 = await versionByNumber(2);
    await publishVersionTemporarily(db, v2.id, async () => {
      const state = await loadQuestionnaire(db, attempt.id);
      expect(state.questionSet.version).toBe(1);
      expect(state.questionSet.questions).toHaveLength(15);
      expect(state.questionSet.questions.every((question) => question.maxChoices === 1 && question.kind === "choice" && question.chapter === null)).toBe(true);
      expect(state.startIndex).toBe(3);
      // It can keep answering on its own (now archived) version.
      const fourth = v1.questions[3];
      await expect(saveAnswer(db, attempt.id, fourth.id, fourth.alternatives[1].id)).resolves.toBe(4);
    });
  });

  it("a first answer on a version that is no longer published is refused with VERSION_CHANGED and saves nothing", async () => {
    const v1 = await loadQuestionBank(db, (await versionByNumber(1)).id);
    const attempt = await newAttempt();
    const v2 = await versionByNumber(2);
    await publishVersionTemporarily(db, v2.id, async () => {
      // The customer's page was loaded on version 1; version 2 is published now.
      await expect(saveAnswer(db, attempt.id, v1.questions[0].id, v1.questions[0].alternatives[0].id)).rejects.toMatchObject({
        code: "VERSION_CHANGED",
      });
      const { data } = await db.from("answers").select("id").eq("attempt_id", attempt.id);
      expect(data).toEqual([]);
      // The new page of the same attempt is version 2 from step 1.
      const state = await loadQuestionnaire(db, attempt.id);
      expect(state.questionSet.version).toBe(2);
      expect(state.startIndex).toBe(0);
    });
  });

  it("the loader reports unavailable when no version is published", async () => {
    const v1 = await loadQuestionBank(db, (await versionByNumber(1)).id);
    const pinned = await newAttempt();
    await saveAnswer(db, pinned.id, v1.questions[0].id, v1.questions[0].alternatives[0].id);
    const fresh = await newAttempt();
    const { count: attemptsBefore } = await db.from("purchase_attempts").select("id", { count: "exact", head: true });

    const restore = await snapshotPublished();
    try {
      await db.from("questionnaire_versions").update({ status: "archived" }).eq("status", "published");
      expect(await publishedVersions()).toEqual([]);
      expect(await loadQuestionnairePage(db, fresh.id)).toEqual({ status: "unavailable" });
      // An attempt that already has answers keeps its own version.
      const page = await loadQuestionnairePage(db, pinned.id);
      expect(page.status).toBe("ready");
      // A first answer is refused with UNAVAILABLE.
      await expect(saveAnswer(db, fresh.id, v1.questions[0].id, v1.questions[0].alternatives[0].id)).rejects.toMatchObject({
        code: "UNAVAILABLE",
      });
    } finally {
      await restore();
    }
    // Nothing was created by looking at the page.
    const { count: attemptsAfter } = await db.from("purchase_attempts").select("id", { count: "exact", head: true });
    expect(attemptsAfter).toBe(attemptsBefore);
    expect(await publishedVersions()).toEqual([1]);
  });

  it("publishing version 2 does not change a stored version 1 result or its scoring input", async () => {
    const v1 = await loadQuestionBank(db, (await versionByNumber(1)).id);
    const attempt = await newAttempt();
    for (const question of v1.questions) {
      await saveAnswer(db, attempt.id, question.id, question.alternatives[question.position % 4].id);
    }
    const scoreNow = async () =>
      scoreAnswers(await getScoredAnswers(db, attempt.id), await getScoringRules(db, attempt.id));
    const before = await scoreNow();
    const { data: resultsBefore } = await db.from("results").select("id, version_id, points, predominant_style, secondary_style").order("id");

    const v2 = await versionByNumber(2);
    await publishVersionTemporarily(db, v2.id, async () => {
      expect(await scoreNow()).toEqual(before);
      const { data: resultsDuring } = await db.from("results").select("id, version_id, points, predominant_style, secondary_style").order("id");
      expect(resultsDuring).toEqual(resultsBefore);
    });
    expect(await scoreNow()).toEqual(before);
  });
});

describe("the publish command", () => {
  function run(...args: string[]) {
    const result = spawnSync(process.execPath, ["scripts/publish-questionnaire-version.mjs", ...args], {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
    });
    return { code: result.status, out: `${result.stdout}${result.stderr}` };
  }

  it("prints the published and the archived version, and refuses a version that is already published", async () => {
    const restore = await snapshotPublished();
    try {
      const draft = await insertSet(version2Steps());
      const ok = run(String(draft.version));
      expect(ok.code).toBe(0);
      expect(ok.out).toContain(`published version ${draft.version}, archived version 1`);
      expect(await publishedVersions()).toEqual([draft.version]);

      const again = run(String(draft.version));
      expect(again.code).toBe(1);
      expect(again.out).toContain("already published");
    } finally {
      await restore();
    }
    expect(await publishedVersions()).toEqual([1]);
  });

  it("exits with a non-zero code and names the rule and the style for an invalid draft", async () => {
    const steps = version2Steps();
    steps[0].styles[0] = STYLES.find((style) => !steps[0].styles.includes(style))!;
    const draft = await insertSet(steps);
    const result = run(String(draft.version));
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/INVALID_SET: STYLE_BALANCE: [a-z_]+ appears in (8|10) steps, expected 9/);
    expect(await publishedVersions()).toEqual([1]);
  });

  it("exits with a usage error without a version number and with an error for an unknown one", () => {
    expect(run().code).toBe(2);
    const unknown = run("987654");
    expect(unknown.code).toBe(1);
    expect(unknown.out).toContain("does not exist");
  });
});
