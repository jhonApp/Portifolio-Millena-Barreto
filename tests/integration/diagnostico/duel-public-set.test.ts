import { describe, expect, it } from "vitest";
import { STYLES } from "@/lib/diagnostico/constants";
import { DUEL_LOOKS, duelLookPath } from "@/lib/diagnostico/duel-looks";
import { getPublicQuestionSet } from "@/lib/diagnostico/question-bank";
import { adminClient } from "./helpers";

const db = adminClient();

async function versionTwoSet() {
  const { data: version } = await db.from("questionnaire_versions").select("id").eq("version", 2).single();
  return getPublicQuestionSet(db, "duel-seed", version!.id);
}

describe("the public set of version 2 with duels", () => {
  it("version 2 has three duels with two looks each, at steps 5, 10 and 15", async () => {
    const set = await versionTwoSet();
    const duels = set.questions.filter((question) => question.kind === "duel");
    expect(duels.map((duel) => duel.position)).toEqual([5, 10, 15]);
    for (const duel of duels) {
      expect(duel.maxChoices).toBe(1);
      expect(duel.alternatives).toHaveLength(2);
      expect(duel.alternatives.map((alternative) => alternative.text).sort()).toEqual(["Look A", "Look B"]);
      for (const alternative of duel.alternatives) {
        expect(alternative.image).toBeDefined();
        expect(alternative.image!.src).toBe(duelLookPath(alternative.id));
        expect(alternative.image!.width).toBeGreaterThan(0);
        expect(alternative.image!.height).toBeGreaterThan(0);
      }
    }
    // The six looks are six different alternatives.
    expect(new Set(duels.flatMap((duel) => duel.alternatives.map((alternative) => alternative.id))).size).toBe(6);
  });

  it("the sizes of the looks are the ones of the registry", async () => {
    const set = await versionTwoSet();
    const { data } = await db
      .from("alternatives")
      .select("id, style")
      .in("id", set.questions.filter((q) => q.kind === "duel").flatMap((q) => q.alternatives.map((a) => a.id)));
    for (const row of data ?? []) {
      const alternative = set.questions.flatMap((q) => q.alternatives).find((a) => a.id === row.id)!;
      const look = DUEL_LOOKS[row.style as keyof typeof DUEL_LOOKS];
      expect([alternative.image!.width, alternative.image!.height]).toEqual([look.width, look.height]);
    }
  });

  it("regular alternatives have no image", async () => {
    const set = await versionTwoSet();
    for (const question of set.questions.filter((q) => q.kind === "choice")) {
      for (const alternative of question.alternatives) expect(Object.keys(alternative).sort()).toEqual(["id", "text"]);
    }
  });

  it("the public set has no style key, weight or file name", async () => {
    const set = await versionTwoSet();
    const duelsJson = JSON.stringify(set.questions.filter((question) => question.kind === "duel"));
    expect(duelsJson).not.toContain('"style"');
    expect(duelsJson).not.toContain('"weight"');
    for (const style of STYLES) expect(duelsJson).not.toContain(style);
    expect(duelsJson).not.toMatch(/esportivo|\.jpg|\.png|pdf-images|assets\//i);
    const wholeJson = JSON.stringify(set);
    expect(wholeJson).not.toContain('"style"');
    expect(wholeJson).not.toContain('"weight"');
  });

  it("version 1 is unchanged: no alternative has an image", async () => {
    const { data: version } = await db.from("questionnaire_versions").select("id").eq("version", 1).single();
    const set = await getPublicQuestionSet(db, "seed", version!.id);
    for (const question of set.questions) {
      for (const alternative of question.alternatives) expect("image" in alternative).toBe(false);
    }
  });
});
