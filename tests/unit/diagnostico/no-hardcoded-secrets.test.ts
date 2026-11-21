import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const SCAN_DIRS = ["lib/diagnostico", "app/diagnostico-estilo", "components/Diagnostico", "app/api"];

function walk(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    const full = path.join(abs, entry);
    if (statSync(full).isDirectory()) out.push(...walk(path.join(dir, entry)));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("secrets and simulation routes", () => {
  it("new source files contain no key-like literal", () => {
    const patterns = [/eyJ[A-Za-z0-9_-]{20,}/, /sk_(live|test)_[A-Za-z0-9]+/, /sb_secret_[A-Za-z0-9]+/, /re_[A-Za-z0-9]{20,}/];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        if (file.endsWith("database.types.ts")) continue;
        const text = readFileSync(file, "utf8");
        for (const p of patterns) {
          expect(p.test(text), `${file} matches ${p}`).toBe(false);
        }
      }
    }
  });

  it("no simulation route exists under app/api", () => {
    const files = walk("app/api").map((f) => f.toLowerCase());
    expect(files.filter((f) => f.includes("simulat"))).toEqual([]);
  });
});
