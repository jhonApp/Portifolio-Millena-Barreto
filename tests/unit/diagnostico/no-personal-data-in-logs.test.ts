import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// RF-09: logs never contain names, e-mails, phone numbers or tokens. This is a static guard over the
// diagnosis code: it reads every console.* call and refuses an argument that names such a value.
// It cannot prove the absence of a leak, but it blocks the usual ways one gets in (logging a body,
// a customer row, an e-mail or a token variable).

const ROOT = path.resolve(import.meta.dirname, "../../..");
const FOLDERS = ["app/api/diagnostico", "lib/diagnostico"];

function sourceFiles(folder: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(folder)) {
    const full = path.join(folder, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts") && entry !== "database.types.ts") out.push(full);
  }
  return out;
}

/** The text of every console call (from `console.x(` to the matching parenthesis). */
function consoleCalls(source: string): string[] {
  const calls: string[] = [];
  const start = /console\.(log|info|warn|error|debug)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = start.exec(source))) {
    let depth = 1;
    let i = start.lastIndex;
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
    }
    calls.push(source.slice(match.index, i));
  }
  return calls;
}

// Names of values that carry personal data or credentials.
const FORBIDDEN = /\b(email|e-mail|whatsapp|phone|telefone|fullName|firstName|customerName|token|rawBody|body|customer|answers)\b/i;

describe("logs carry no personal data", () => {
  it("no console call in the diagnosis code writes a name, e-mail, phone or token", () => {
    const offenders: string[] = [];
    for (const folder of FOLDERS) {
      for (const file of sourceFiles(path.join(ROOT, folder))) {
        for (const call of consoleCalls(readFileSync(file, "utf8"))) {
          // Text inside quotes is a fixed message, never data: only the arguments are inspected.
          const withoutStrings = call.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
          if (FORBIDDEN.test(withoutStrings)) offenders.push(`${path.relative(ROOT, file)}: ${call.replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the scan does see the console calls of the code (it is not vacuous)", () => {
    let total = 0;
    for (const folder of FOLDERS) {
      for (const file of sourceFiles(path.join(ROOT, folder))) total += consoleCalls(readFileSync(file, "utf8")).length;
    }
    expect(total).toBeGreaterThan(15);
  });

  it("the scan catches a call that logs an e-mail or a token", () => {
    const bad = consoleCalls('console.error("failed", email); console.warn("x", { token });');
    expect(bad).toHaveLength(2);
    for (const call of bad) expect(FORBIDDEN.test(call.replace(/"[^"]*"/g, '""'))).toBe(true);
  });
});
