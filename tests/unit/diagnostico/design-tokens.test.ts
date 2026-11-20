import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const tailwind = require(path.join(root, "tailwind.config.js"));
const DIAGNOSIS_DIRS = ["app/diagnostico-estilo", "components/Diagnostico"];

function walk(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    const full = path.join(abs, entry);
    if (statSync(full).isDirectory()) out.push(...walk(path.join(dir, entry)));
    else if (/\.(ts|tsx|js|jsx|css)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("design reuse", () => {
  it("theme keeps primary secondary and accent values", () => {
    expect(tailwind.theme.extend.colors.primary).toBe("#10151f");
    expect(tailwind.theme.extend.colors.secondary).toBe("#475467");
    expect(tailwind.theme.extend.colors.accent.DEFAULT).toBe("#937dad");
  });

  it("font families are the existing primary and secondary variables", () => {
    expect(tailwind.theme.fontFamily).toEqual({
      primary: "var(--font-bebas)",
      secondary: "var(--font-inter)",
    });
  });

  it("diagnosis files import no additional font", () => {
    for (const file of DIAGNOSIS_DIRS.flatMap(walk)) {
      const text = readFileSync(file, "utf8");
      expect(/next\/font|fonts\.googleapis|@font-face/.test(text), file).toBe(false);
    }
  });

  it("diagnosis files define no new hex color", () => {
    for (const file of DIAGNOSIS_DIRS.flatMap(walk)) {
      const text = readFileSync(file, "utf8");
      expect(/#[0-9a-fA-F]{3,8}\b/.test(text), file).toBe(false);
    }
  });
});
