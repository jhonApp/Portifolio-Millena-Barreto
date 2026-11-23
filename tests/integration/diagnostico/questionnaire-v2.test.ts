import { afterAll, describe, expect, it } from "vitest";
import { STYLES } from "@/lib/diagnostico/constants";
import { adminClient, publishVersionTemporarily } from "./helpers";

const db = adminClient();

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

describe("publishing", () => {
  afterAll(async () => {
    // Safety net: the shared database must end with version 1 published and version 2 a draft.
    expect(await publishedVersions()).toEqual([1]);
  });

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
});
