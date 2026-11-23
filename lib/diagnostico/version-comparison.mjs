// Completion comparison by questionnaire version (RF-05). Plain ESM so the command
// (scripts/quiz-compare.mjs), the tests and the future admin panel share one copy of the rules.
// Source: the view attempt_version_outcomes (RF-02), one row per attempt with at least 1 answer.
// Operator texts are drafts in Portuguese for Millena's review.

/** A version with fewer attempts than this is marked "poucos dados". */
export const MIN_ATTEMPTS = 100;
/** A version more than this many percentage points below the baseline carries the warning. */
export const WARNING_DROP_POINTS = 5;
/** Every version is compared with this one. */
export const BASELINE_VERSION = 1;
/** Rows read from the view per request. */
export const PAGE_SIZE = 1000;

export const LABEL_FEW_DATA = "poucos dados";
export const LABEL_WARNING = "ATENÇÃO";
export const MESSAGE_NO_ATTEMPTS = "Nenhuma tentativa no período.";

const VIEW = "attempt_version_outcomes";

/**
 * @typedef {{ attempt_id: string, version: number, started_at: string, reached_checkout: boolean }} OutcomeRow
 * @typedef {{
 *   version: number, started: number, reachedCheckout: number, ratePercent: number,
 *   fewData: boolean, differencePoints: number | null, warning: boolean
 * }} VersionSummary
 */

/**
 * Turns the --since option (AAAA-MM-DD) into the start of that day in Brazil time (UTC-03:00), as
 * an ISO timestamp. No value means "all attempts" (null). Throws on anything that is not a real date.
 * @param {string | undefined} value
 * @returns {string | null}
 */
export function parseSince(value) {
  if (value === undefined) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Data inválida em --since: use AAAA-MM-DD");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Data inválida em --since: use AAAA-MM-DD");
  }
  return `${value}T00:00:00-03:00`;
}

/**
 * Reads the whole view (optionally from `since` on) in pages of PAGE_SIZE rows, in a stable order
 * so no row is skipped or repeated between pages. Select only: nothing is written.
 * @param {any} client a supabase-js client
 * @param {{ since?: string | null }} [options]
 * @returns {Promise<OutcomeRow[]>}
 */
export async function readOutcomeRows(client, { since = null } = {}) {
  /** @type {OutcomeRow[]} */
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client
      .from(VIEW)
      .select("attempt_id, version, started_at, reached_checkout")
      .order("attempt_id", { ascending: true });
    if (since) query = query.gte("started_at", since);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

/**
 * One summary per version that has attempts, ascending. The difference against the baseline is
 * computed from the unrounded rates; the warning compares exact integers, so a drop of exactly
 * WARNING_DROP_POINTS is never a warning.
 * @param {OutcomeRow[]} rows
 * @returns {VersionSummary[]}
 */
export function summarizeVersions(rows) {
  /** @type {Map<number, { started: number, reached: number }>} */
  const counts = new Map();
  for (const row of rows) {
    const entry = counts.get(row.version) ?? { started: 0, reached: 0 };
    entry.started += 1;
    if (row.reached_checkout) entry.reached += 1;
    counts.set(row.version, entry);
  }
  const base = counts.get(BASELINE_VERSION);
  return [...counts.keys()]
    .sort((a, b) => a - b)
    .map((version) => {
      const { started, reached } = counts.get(version);
      const ratePercent = (reached * 100) / started;
      const compared = base !== undefined && version !== BASELINE_VERSION;
      // difference = 100 * (reached / started - baseReached / baseStarted)
      const differencePoints = compared ? ratePercent - (base.reached * 100) / base.started : null;
      // difference < -N  <=>  100 * (r*bs - br*s) < -N * s * bs   (all integers)
      const warning =
        compared && 100 * (reached * base.started - base.reached * started) < -WARNING_DROP_POINTS * started * base.started;
      return {
        version,
        started,
        reachedCheckout: reached,
        ratePercent,
        fewData: started < MIN_ATTEMPTS,
        differencePoints,
        warning,
      };
    });
}

/** "50,0" for 50 (one decimal, decimal comma). */
function decimal(value) {
  return value.toFixed(1).replace(".", ",");
}

function formatDifference(points) {
  if (points === null) return "—";
  const text = decimal(Math.abs(points));
  if (text === "0,0") return "0,0 pp";
  return `${points < 0 ? "-" : "+"}${text} pp`;
}

function periodLabel(since) {
  return since ? `desde ${since.slice(0, 10)}` : "desde o início";
}

/**
 * The terminal table. The first line always states the period.
 * @param {VersionSummary[]} summary
 * @param {string | null} since
 */
export function formatTable(summary, since) {
  const title = `Comparação de versões do questionário (${periodLabel(since)})`;
  if (summary.length === 0) return `${title}\n\n${MESSAGE_NO_ATTEMPTS}`;
  const header = ["Versão", "Iniciadas", "Chegaram ao checkout", "Taxa", "Diferença vs v1"];
  const body = summary.map((item) => [
    String(item.version),
    String(item.started),
    String(item.reachedCheckout),
    `${decimal(item.ratePercent)}%`,
    formatDifference(item.differencePoints),
  ]);
  const widths = header.map((title, column) => Math.max(title.length, ...body.map((row) => row[column].length)));
  const line = (cells) => cells.map((cell, column) => cell.padEnd(widths[column])).join("  ");
  const notes = summary.map((item) => {
    const marks = [];
    if (item.warning) marks.push(LABEL_WARNING);
    if (item.fewData) marks.push(`(${LABEL_FEW_DATA})`);
    return marks.length ? `  ${marks.join("  ")}` : "";
  });
  const lines = body.map((row, index) => (line(row) + notes[index]).trimEnd());
  return [title, "", line(header).trimEnd(), ...lines].join("\n");
}

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * The same figures as JSON, with rates and differences rounded to 1 decimal.
 * @param {VersionSummary[]} summary
 * @param {string | null} since
 */
export function formatJson(summary, since) {
  return JSON.stringify(
    {
      since: since ? since.slice(0, 10) : null,
      versions: summary.map((item) => ({
        version: item.version,
        started: item.started,
        reachedCheckout: item.reachedCheckout,
        ratePercent: round1(item.ratePercent),
        fewData: item.fewData,
        differencePoints: item.differencePoints === null ? null : round1(item.differencePoints),
        warning: item.warning,
      })),
    },
    null,
    2,
  );
}
