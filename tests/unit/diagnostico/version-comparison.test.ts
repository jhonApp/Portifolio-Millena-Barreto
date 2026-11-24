import { describe, expect, it } from "vitest";
import {
  MIN_ATTEMPTS,
  PAGE_SIZE,
  formatJson,
  formatTable,
  parseSince,
  readOutcomeRows,
  summarizeVersions,
} from "@/lib/diagnostico/version-comparison.mjs";

type Row = { attempt_id: string; version: number; started_at: string; reached_checkout: boolean };

let counter = 0;
function rows(version: number, started: number, reached: number, at = "2026-12-01T12:00:00Z"): Row[] {
  return Array.from({ length: started }, (_, i) => ({
    attempt_id: `a${++counter}`,
    version,
    started_at: at,
    reached_checkout: i < reached,
  }));
}

describe("summarizeVersions", () => {
  it("120 started and 60 at the checkout give 50.0%", () => {
    const [one] = summarizeVersions(rows(1, 120, 60));
    expect(one).toMatchObject({ version: 1, started: 120, reachedCheckout: 60, ratePercent: 50, fewData: false });
    expect(one.differencePoints).toBeNull();
    expect(one.warning).toBe(false);
  });

  it("a version with 99 attempts is marked fewData", () => {
    expect(summarizeVersions(rows(1, 99, 10))[0].fewData).toBe(true);
  });

  it("a version with exactly 100 attempts is not marked", () => {
    expect(MIN_ATTEMPTS).toBe(100);
    expect(summarizeVersions(rows(1, 100, 10))[0].fewData).toBe(false);
  });

  it("version 2 ten points below version 1 gets the warning", () => {
    const [, two] = summarizeVersions([...rows(1, 120, 60), ...rows(2, 80, 32)]);
    expect(two.differencePoints).toBeCloseTo(-10, 10);
    expect(two.warning).toBe(true);
    expect(two.fewData).toBe(true);
  });

  it("exactly 5 points below is not a warning", () => {
    const [, two] = summarizeVersions([...rows(1, 100, 50), ...rows(2, 100, 45)]);
    expect(two.differencePoints).toBeCloseTo(-5, 10);
    expect(two.warning).toBe(false);
  });

  it("the warning uses the unrounded difference", () => {
    // 5.04 points below: it prints as -5,0 pp but is still a warning.
    const [one, two] = summarizeVersions([...rows(1, 10000, 5000), ...rows(2, 10000, 4496)]);
    expect(formatTable([one, two], null)).toContain("-5,0 pp");
    expect(two.warning).toBe(true);
  });

  it("no difference and no warning when version 1 has no attempts", () => {
    const [two] = summarizeVersions(rows(2, 150, 1));
    expect(two.differencePoints).toBeNull();
    expect(two.warning).toBe(false);
  });

  it("a version above version 1 has a positive difference and no warning", () => {
    const [, two] = summarizeVersions([...rows(1, 100, 40), ...rows(2, 100, 50)]);
    expect(two.differencePoints).toBeCloseTo(10, 10);
    expect(two.warning).toBe(false);
  });

  it("the versions are listed in ascending order and a version without attempts is not listed", () => {
    const summary = summarizeVersions([...rows(3, 2, 1), ...rows(1, 2, 1)]);
    expect(summary.map((item) => item.version)).toEqual([1, 3]);
    expect(summarizeVersions([])).toEqual([]);
  });
});

describe("formats", () => {
  const summary = summarizeVersions([...rows(1, 120, 60), ...rows(2, 80, 32)]);

  it("formatTable shows 120, 60 and 50,0% for version 1", () => {
    const table = formatTable(summary, null);
    const versionOne = table.split("\n").find((line) => line.startsWith("1 "))!;
    expect(versionOne).toMatch(/^1\s+120\s+60\s+50,0%\s+—$/);
  });

  it("formatTable prints poucos dados for a marked version and the warning", () => {
    const versionTwo = formatTable(summary, null).split("\n").find((line) => line.startsWith("2 "))!;
    expect(versionTwo).toMatch(/^2\s+80\s+32\s+40,0%\s+-10,0 pp\s+ATENÇÃO\s+\(poucos dados\)$/);
    expect(formatTable(summary, null).split("\n").find((line) => line.startsWith("1 "))).not.toContain("poucos dados");
  });

  it("formatTable states the period on its first line", () => {
    expect(formatTable(summary, null).split("\n")[0]).toBe("Comparação de versões do questionário (desde o início)");
    expect(formatTable(summary, "2026-12-01T00:00:00-03:00").split("\n")[0]).toBe(
      "Comparação de versões do questionário (desde 2026-12-01)",
    );
  });

  it("formatTable says so when there is no attempt", () => {
    expect(formatTable([], null)).toContain("Nenhuma tentativa no período.");
  });

  it("formatJson rounds to one decimal", () => {
    const parsed = JSON.parse(formatJson(summarizeVersions([...rows(1, 3, 1), ...rows(2, 3, 2)]), "2026-12-01T00:00:00-03:00"));
    expect(parsed.since).toBe("2026-12-01");
    expect(parsed.versions[0]).toMatchObject({ version: 1, started: 3, reachedCheckout: 1, ratePercent: 33.3, differencePoints: null });
    expect(parsed.versions[1]).toMatchObject({ ratePercent: 66.7, differencePoints: 33.3, warning: false, fewData: true });
    expect(JSON.parse(formatJson([], null))).toEqual({ since: null, versions: [] });
  });

  it("the output has only aggregated figures, no attempt id", () => {
    const text = formatTable(summary, null) + formatJson(summary, null);
    expect(text).not.toMatch(/\ba\d+\b/);
  });
});

describe("parseSince", () => {
  it("parseSince turns AAAA-MM-DD into the start of the day in Brazil time", () => {
    expect(parseSince("2026-12-01")).toBe("2026-12-01T00:00:00-03:00");
    expect(parseSince("2028-02-29")).toBe("2028-02-29T00:00:00-03:00");
  });

  it("parseSince rejects 2026-13-01 and ontem", () => {
    for (const bad of ["2026-13-01", "ontem", "2026-02-30", "2026-1-1", "", "2026-12-01x"]) {
      expect(() => parseSince(bad), bad).toThrow("Data inválida em --since: use AAAA-MM-DD");
    }
  });

  it("parseSince returns null when the option is absent", () => {
    expect(parseSince(undefined)).toBeNull();
  });
});

/** A fake client: the view is a list of rows, the query chain records its calls. */
function fakeClient(all: Row[], failWith?: string) {
  const calls: { table: string; gte: [string, string][]; ranges: [number, number][]; order: string[] } = {
    table: "",
    gte: [],
    ranges: [],
    order: [],
  };
  const client = {
    from(table: string) {
      calls.table = table;
      let filtered = all;
      const query = {
        select: () => query,
        order(column: string) {
          calls.order.push(column);
          return query;
        },
        gte(column: string, value: string) {
          calls.gte.push([column, value]);
          filtered = filtered.filter((row) => (row as Record<string, unknown>)[column]! >= value);
          return query;
        },
        async range(from: number, to: number) {
          calls.ranges.push([from, to]);
          if (failWith) return { data: null, error: { message: failWith } };
          return { data: filtered.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
  };
  return { client, calls };
}

describe("readOutcomeRows", () => {
  it("readOutcomeRows reads every page until a short page", async () => {
    const all = rows(1, PAGE_SIZE * 2 + 5, 0);
    const { client, calls } = fakeClient(all);
    const read = await readOutcomeRows(client);
    expect(read).toHaveLength(PAGE_SIZE * 2 + 5);
    expect(new Set(read.map((row: Row) => row.attempt_id)).size).toBe(all.length);
    expect(calls.ranges).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, PAGE_SIZE * 2 - 1],
      [PAGE_SIZE * 2, PAGE_SIZE * 3 - 1],
    ]);
    expect(calls.table).toBe("attempt_version_outcomes");
    expect(calls.order[0]).toBe("attempt_id");
  });

  it("an exact multiple of the page size reads one more, empty, page", async () => {
    const { client, calls } = fakeClient(rows(1, PAGE_SIZE, 0));
    expect(await readOutcomeRows(client)).toHaveLength(PAGE_SIZE);
    expect(calls.ranges).toHaveLength(2);
  });

  it("readOutcomeRows applies the period as a lower bound on started_at", async () => {
    const all = [...rows(1, 3, 0, "2026-11-30T10:00:00-03:00"), ...rows(1, 2, 0, "2026-12-02T10:00:00-03:00")];
    const { client, calls } = fakeClient(all);
    const read = await readOutcomeRows(client, { since: "2026-12-01T00:00:00-03:00" });
    expect(read).toHaveLength(2);
    expect(calls.gte).toEqual([["started_at", "2026-12-01T00:00:00-03:00"]]);
    const none = fakeClient(all);
    await readOutcomeRows(none.client);
    expect(none.calls.gte).toEqual([]);
  });

  it("a failed read throws the message of the error", async () => {
    await expect(readOutcomeRows(fakeClient([], "relation does not exist").client)).rejects.toThrow("relation does not exist");
  });
});
