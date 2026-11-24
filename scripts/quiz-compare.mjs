// Prints the completion comparison by questionnaire version (RF-05):
//   npm run quiz:compare -- [--since AAAA-MM-DD] [--json]
// Read only: it selects from the view attempt_version_outcomes and nothing else. Exit codes: 0 ok,
// 1 wrong usage or missing environment, 2 the data could not be read. Never prints a key or an id.
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import { formatJson, formatTable, parseSince, readOutcomeRows, summarizeVersions } from "../lib/diagnostico/version-comparison.mjs";

nextEnv.loadEnvConfig(process.cwd());

const USAGE = "Uso: npm run quiz:compare -- [--since AAAA-MM-DD] [--json]";

/** @returns {{ since: string | undefined, json: boolean } | null} null for an unknown argument */
function parseArguments(args) {
  let since;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json") json = true;
    else if (args[i] === "--since") since = args[++i] ?? "";
    else return null;
  }
  return { since, json };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) {
    console.error(USAGE);
    return 1;
  }
  let since;
  try {
    since = parseSince(options.since);
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[name]) {
      console.error(`Variável de ambiente ausente: ${name}`);
      return 1;
    }
  }

  let rows;
  try {
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    rows = await readOutcomeRows(client, { since });
  } catch (error) {
    console.error(`Não foi possível ler os dados: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    return 2;
  }
  const summary = summarizeVersions(rows);
  console.log(options.json ? formatJson(summary, since) : formatTable(summary, since));
  return 0;
}

// process.exitCode (not process.exit): exiting with network handles open crashes Node on Windows.
main().then((code) => {
  process.exitCode = code;
});
