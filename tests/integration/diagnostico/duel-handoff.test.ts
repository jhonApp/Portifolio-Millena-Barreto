import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSavedChoices, saveAnswer } from "@/lib/diagnostico/answers";
import { STYLES, type Style } from "@/lib/diagnostico/constants";
import { duelLookPath } from "@/lib/diagnostico/duel-looks";
import { getPublicQuestionSet, getScoredAnswers, getScoringRules } from "@/lib/diagnostico/question-bank";
import { scoreAnswers } from "@/lib/diagnostico/scoring";
import { adminClient, createAttempt, createCustomer, makeVersionOneLive, publishVersionTemporarily } from "./helpers";

// Hand-offs of RF-03 as the consumer. RF-02 serves the duel steps of version 2; RF-01 saves the
// choice and scores it. Both contracts are the real ones: nothing is mocked.

const db = adminClient();
const customerIds: string[] = [];
let restoreLive: () => Promise<void>;
let versionTwoId: string;

beforeAll(async () => {
  restoreLive = await makeVersionOneLive(db);
  const { data } = await db.from("questionnaire_versions").select("id").eq("version", 2).single();
  versionTwoId = data!.id;
});

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  await restoreLive();
});

async function newAttempt() {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  return createAttempt(db, customer.id);
}

async function styleOf(alternativeId: string): Promise<Style> {
  const { data } = await db.from("alternatives").select("style").eq("id", alternativeId).single();
  return data!.style as Style;
}

/** Saves the 15 steps of version 2 for an attempt (first alternative of each regular step) and, at step 5, the look of the given style. */
async function answerAll(attemptId: string, wantedStyle: Style) {
  const set = await getPublicQuestionSet(db, attemptId, versionTwoId);
  const chosen: { id: string; style: Style }[] = [];
  for (const question of set.questions) {
    if (question.kind === "duel") {
      // The first duel gets the look under test; the other two always take their first look.
      let pick = question.alternatives[0];
      if (question.position === 5) {
        for (const look of question.alternatives) if ((await styleOf(look.id)) === wantedStyle) pick = look;
      }
      await saveAnswer(db, attemptId, question.id, pick.id);
      if (question.position === 5) chosen.push({ id: pick.id, style: await styleOf(pick.id) });
    } else {
      await saveAnswer(db, attemptId, question.id, question.alternatives[0].id);
    }
  }
  return { set, chosen: chosen[0] };
}

describe("RF-02 to RF-03 hand-off", () => {
  it("a duel step of the real version 2 carries its two looks and the choice is saved through saveAnswer", async () => {
    const attempt = await newAttempt();
    await publishVersionTemporarily(db, versionTwoId, async () => {
      const set = await getPublicQuestionSet(db, attempt.id);
      expect(set.version).toBe(2);
      const duel = set.questions.find((question) => question.position === 5)!;
      // What the duel screen receives: the kind, the position, the question and two looks with
      // neutral ids, the neutral texts and the image data (address with the id only, and its size).
      expect(duel.kind).toBe("duel");
      expect(duel.maxChoices).toBe(1);
      expect(duel.alternatives).toHaveLength(2);
      for (const look of duel.alternatives) {
        expect(look.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(["Look A", "Look B"]).toContain(look.text);
        expect(look.image).toMatchObject({ src: duelLookPath(look.id) });
        expect(look.image!.width).toBeGreaterThan(0);
      }
      expect(JSON.stringify(duel)).not.toMatch(new RegExp(`${STYLES.join("|")}|"style"|"weight"`, "i"));

      // The choice is saved through RF-01 as a first choice with no second one, and read back.
      const pick = duel.alternatives[1];
      expect(await saveAnswer(db, attempt.id, duel.id, pick.id)).toBe(1);
      expect((await getSavedChoices(db, attempt.id))[duel.id]).toEqual({ first: pick.id, second: null });
      // A second choice on a duel is refused (a duel allows one look).
      await expect(saveAnswer(db, attempt.id, duel.id, pick.id, duel.alternatives[0].id)).rejects.toMatchObject({
        code: "CHOICE_NOT_ALLOWED",
      });
      // A look of another duel is not an alternative of this one.
      const other = set.questions.find((question) => question.position === 10)!;
      await expect(saveAnswer(db, attempt.id, duel.id, other.alternatives[0].id)).rejects.toMatchObject({
        code: "ALTERNATIVE_MISMATCH",
      });
    });
  });
});

describe("RF-01 to RF-03 hand-off", () => {
  it("a duel choice gives exactly 2 points to the chosen style and 0 to the other", async () => {
    const first = await newAttempt();
    const second = await newAttempt();
    let outcomes: Awaited<ReturnType<typeof answerAll>>[] = [];
    await publishVersionTemporarily(db, versionTwoId, async () => {
      // Step 5 of version 2 is Esportivo/Natural x Elegante; the order of the looks is shuffled per attempt.
      outcomes = [await answerAll(first.id, "esportivo_natural"), await answerAll(second.id, "elegante")];
    });
    const [a, b] = outcomes;
    expect(a.chosen.style).not.toBe(b.chosen.style); // the two looks of the duel are two styles

    const pointsOf = async (attemptId: string) => {
      const items = await getScoredAnswers(db, attemptId);
      expect(new Set(items.map((item) => item.questionPosition)).size).toBe(15);
      const rules = await getScoringRules(db, attemptId);
      expect(rules.firstPoints).toBe(2);
      const result = scoreAnswers(items, rules);
      // The same attempt without the duel step: the tally of every other item by hand.
      const rest = Object.fromEntries(STYLES.map((style) => [style, 0])) as Record<Style, number>;
      for (const item of items.filter((candidate) => candidate.questionPosition !== 5)) {
        rest[item.style] += item.weight * (item.rank === 2 ? rules.secondPoints : rules.firstPoints);
      }
      return { points: result.points, rest };
    };

    const one = await pointsOf(first.id);
    const two = await pointsOf(second.id);
    for (const style of STYLES) {
      expect(one.points[style] - one.rest[style], `attempt 1, ${style}`).toBe(style === a.chosen.style ? 2 : 0);
      expect(two.points[style] - two.rest[style], `attempt 2, ${style}`).toBe(style === b.chosen.style ? 2 : 0);
    }
  });
});
