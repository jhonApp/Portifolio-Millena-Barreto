import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/diagnostico/duel-look/[alternativeId]/route";
import { STYLES } from "@/lib/diagnostico/constants";
import { DUEL_LOOKS, duelLooksFolder } from "@/lib/diagnostico/duel-looks";
import { adminClient } from "./helpers";

const db = adminClient();
const STYLE_WORDS = new RegExp([...STYLES, "esportivo", "natural"].join("|"), "i");

async function duelAlternatives() {
  const { data: version } = await db.from("questionnaire_versions").select("id").eq("version", 2).single();
  const { data: questions } = await db
    .from("questions")
    .select("id, position, kind")
    .eq("version_id", version!.id)
    .order("position");
  const { data: alternatives } = await db
    .from("alternatives")
    .select("id, question_id, position, style")
    .in("question_id", (questions ?? []).map((question) => question.id))
    .order("position");
  return (questions ?? []).map((question) => ({
    ...question,
    alternatives: (alternatives ?? []).filter((alternative) => alternative.question_id === question.id),
  }));
}

const call = (id: string) => GET(new Request(`http://localhost/api/diagnostico/duel-look/${id}`), { params: { alternativeId: id } });

describe("GET /api/diagnostico/duel-look/[alternativeId]", () => {
  it("returns the bytes of the light copy with cache headers", async () => {
    const steps = await duelAlternatives();
    const duel = steps.find((step) => step.kind === "duel")!;
    for (const alternative of duel.alternatives) {
      const response = await call(alternative.id);
      expect(response.status).toBe(200);
      const expected = readFileSync(path.join(duelLooksFolder(), DUEL_LOOKS[alternative.style as keyof typeof DUEL_LOOKS].file));
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.equals(expected)).toBe(true);
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      expect(response.headers.get("content-length")).toBe(String(expected.length));
      expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(response.headers.get("etag")).toBe(`"${alternative.id}"`);
      expect(response.headers.get("content-disposition")).toBeNull();
    }
  });

  it("two different duel alternatives return different images", async () => {
    const steps = await duelAlternatives();
    for (const duel of steps.filter((step) => step.kind === "duel")) {
      const [a, b] = await Promise.all(duel.alternatives.map(async (alternative) => Buffer.from(await (await call(alternative.id)).arrayBuffer())));
      expect(a.equals(b)).toBe(false);
    }
  });

  it("answers 404 for a non-UUID id, an unknown alternative and a regular-question alternative", async () => {
    const steps = await duelAlternatives();
    const regular = steps.find((step) => step.kind === "choice")!.alternatives[0];
    const ids = ["not-a-uuid", "../../etc/passwd", "00000000-0000-4000-8000-000000000000", regular.id];
    for (const id of ids) {
      const response = await call(id);
      expect(response.status, id).toBe(404);
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({ error: { code: "NOT_FOUND", message: "Imagem não encontrada." } });
      expect(text).not.toMatch(STYLE_WORDS);
    }
  });

  it("no response header or body names a style", async () => {
    const steps = await duelAlternatives();
    const everything: Response[] = [];
    for (const duel of steps.filter((step) => step.kind === "duel")) {
      for (const alternative of duel.alternatives) everything.push(await call(alternative.id));
    }
    everything.push(await call("nope"));
    for (const response of everything) {
      const headers = Array.from(response.headers.entries()).map(([name, value]) => `${name}: ${value}`).join("\n");
      expect(headers).not.toMatch(STYLE_WORDS);
      expect(headers).not.toMatch(/\.jpg|\.png|filename/i);
    }
  });
});
