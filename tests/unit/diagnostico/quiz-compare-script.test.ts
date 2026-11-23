import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = process.cwd();
const script = path.join(root, "scripts", "quiz-compare.mjs");
const moduleFile = path.join(root, "lib", "diagnostico", "version-comparison.mjs");
// A temporary working directory has no .env.local, so the environment of each run is exactly the one given.
const cwd = mkdtempSync(path.join(tmpdir(), "quiz-compare-"));
afterAll(() => rmSync(cwd, { recursive: true, force: true }));

const FAKE_KEY = "fake-service-role-key-do-not-print-0123456789";

function run(args: string[], env: Record<string, string>) {
  // The system variables stay (Node needs SystemRoot on Windows); the Supabase ones are replaced.
  const base = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith("SUPABASE_")));
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 60000,
    env: { ...base, ...env } as NodeJS.ProcessEnv,
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}`, stderr: result.stderr };
}

describe("the quiz:compare command", () => {
  it("the module and the script only select from attempt_version_outcomes", () => {
    const code = readFileSync(moduleFile, "utf8") + readFileSync(script, "utf8");
    expect(code.match(/\.from\(([^)]*)\)/g)).toEqual(['.from(VIEW)']);
    expect(readFileSync(moduleFile, "utf8")).toContain('const VIEW = "attempt_version_outcomes"');
    expect(code).toContain(".select(");
  });

  it("neither file calls insert, update, delete, upsert, rpc or fetch", () => {
    for (const file of [moduleFile, script]) {
      const code = readFileSync(file, "utf8");
      expect(code, file).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
      expect(code, file).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it("a missing SUPABASE_SERVICE_ROLE_KEY exits with 1 and names only the variable", () => {
    const result = run([], { SUPABASE_URL: "http://127.0.0.1:1" });
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("Variável de ambiente ausente: SUPABASE_SERVICE_ROLE_KEY");
    expect(run([], { SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY }).stderr.trim()).toBe("Variável de ambiente ausente: SUPABASE_URL");
  });

  it("an invalid --since exits with 1", () => {
    for (const args of [["--since", "2026-13-01"], ["--since", "ontem"], ["--since"]]) {
      const result = run(args, { SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY });
      expect(result.status, args.join(" ")).toBe(1);
      expect(result.stderr.trim()).toBe("Data inválida em --since: use AAAA-MM-DD");
    }
  });

  it("an unknown argument prints the usage line and exits with 1", () => {
    const result = run(["--tudo"], {});
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("Uso: npm run quiz:compare -- [--since AAAA-MM-DD] [--json]");
  });

  it("a read that fails exits with 2 and shows no key", () => {
    // An address the client refuses fails at once, after the environment check (a refused
    // connection would take about 8 s on Windows; the failed-read path of the module has its own unit test).
    const result = run(["--json"], { SUPABASE_URL: "not-a-url", SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Não foi possível ler os dados:");
  });

  it("no output line contains the key value", () => {
    const runs = [
      run([], { SUPABASE_URL: "not-a-url", SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY }),
      run(["--since", "x"], { SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY }),
      run(["--json"], { SUPABASE_URL: "not-a-url", SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY }),
    ];
    for (const result of runs) expect(result.out).not.toContain(FAKE_KEY);
  });
});
