import { afterAll, describe, expect, it } from "vitest";
import { STYLES } from "@/lib/diagnostico/constants";
import { ContentError, assertContentComplete, loadPublishedContent } from "@/lib/diagnostico/content-store";
import { adminClient } from "./helpers";

const db = adminClient();
const versionIds: string[] = [];

afterAll(async () => {
  if (versionIds.length) await db.from("content_versions").delete().in("id", versionIds);
});

describe("seeded content version 1", () => {
  it("the seed publishes version 1 with 30 style blocks 30 pair paragraphs 48 pieces and 36 accessories", async () => {
    const { data: version } = await db.from("content_versions").select("*").eq("version", 1).single();
    expect(version).toMatchObject({ status: "published" });
    const counts: Record<string, number> = {};
    const { data: templates } = await db.from("content_templates").select("kind").eq("version_id", version!.id);
    for (const row of templates ?? []) counts[row.kind] = (counts[row.kind] ?? 0) + 1;
    expect(counts).toEqual({ style_block: 30, pair_paragraph: 30, piece: 48, accessory: 36 });
  });

  it("every ordered pair of two different styles has a paragraph", async () => {
    const content = await loadPublishedContent(db);
    for (const first of STYLES) {
      for (const second of STYLES) {
        if (first === second) continue;
        const found = content.templates.filter(
          (t) => t.kind === "pair_paragraph" && t.style === first && t.secondary_style === second,
        );
        expect(found, `${first} > ${second}`).toHaveLength(1);
      }
    }
  });

  it("every style pool has at least 8 pieces and 6 accessories", async () => {
    const content = await loadPublishedContent(db);
    for (const style of STYLES) {
      expect(content.templates.filter((t) => t.kind === "piece" && t.style === style).length).toBeGreaterThanOrEqual(8);
      expect(content.templates.filter((t) => t.kind === "accessory" && t.style === style).length).toBeGreaterThanOrEqual(6);
      for (const block of ["result", "secondary", "pieces", "accessories", "guidance"]) {
        expect(content.templates.filter((t) => t.kind === "style_block" && t.style === style && t.block === block)).toHaveLength(1);
      }
    }
  });

  it("no template is empty", async () => {
    const content = await loadPublishedContent(db);
    expect(content.templates.length).toBe(144);
    for (const template of content.templates) expect(template.body.trim().length).toBeGreaterThan(10);
  });

  it("every ordered pair is complete in the seed", async () => {
    const content = await loadPublishedContent(db);
    for (const first of STYLES) {
      for (const second of STYLES) {
        if (first !== second) expect(() => assertContentComplete(content, first, second)).not.toThrow();
      }
    }
  });
});

describe("loading and completeness", () => {
  it("loadPublishedContent loads the published version only", async () => {
    const { data: draft } = await db
      .from("content_versions")
      .insert({ version: 900000 + Math.floor(Math.random() * 90000), status: "draft" })
      .select()
      .single();
    versionIds.push(draft!.id);
    await db.from("content_templates").insert({ version_id: draft!.id, kind: "piece", style: "elegante", position: 1, body: "Rascunho" });

    const content = await loadPublishedContent(db);
    expect(content.versionId).not.toBe(draft!.id);
    expect(content.templates.some((t) => t.body === "Rascunho")).toBe(false);
  });

  it("assertContentComplete names what is missing", async () => {
    const content = await loadPublishedContent(db);
    const trimmed = {
      ...content,
      templates: content.templates.filter(
        (t) => !(t.kind === "pair_paragraph" && t.style === "criativo" && t.secondary_style === "dramatico") &&
          !(t.kind === "style_block" && t.style === "criativo" && t.block === "guidance"),
      ),
    };
    try {
      assertContentComplete(trimmed, "criativo", "dramatico");
      throw new Error("expected a ContentError");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      expect((error as ContentError).missing.sort()).toEqual(["pair_paragraph:criativo>dramatico", "style_block:criativo:guidance"]);
    }
  });

  it("a deleted pair paragraph is reported as missing", async () => {
    const content = await loadPublishedContent(db);
    const trimmed = {
      ...content,
      templates: content.templates.filter((t) => !(t.kind === "pair_paragraph" && t.style === "elegante" && t.secondary_style === "tradicional")),
    };
    expect(() => assertContentComplete(trimmed, "elegante", "tradicional")).toThrow(/pair_paragraph:elegante>tradicional/);
    expect(() => assertContentComplete(trimmed, "elegante", "romantico")).not.toThrow();
  });

  it("a short pool is reported as missing", async () => {
    const content = await loadPublishedContent(db);
    const trimmed = {
      ...content,
      templates: content.templates.filter((t) => !(t.kind === "piece" && t.style === "dramatico" && t.position > 2)),
    };
    expect(() => assertContentComplete(trimmed, "dramatico", "elegante")).toThrow(/piece:dramatico/);
  });
});
