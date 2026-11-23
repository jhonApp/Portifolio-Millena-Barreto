// Publishes a questionnaire version by its number: npm run quiz:publish -- 2
// The version is validated by the database (the structural rules of its profile) and the published
// version, if any, is archived in the same transaction. Exit codes: 0 published, 1 refused or failed,
// 2 wrong usage. Never prints a key or a connection string.
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const number = Number(process.argv[2]);
if (!Number.isInteger(number) || number < 1) {
  console.error("usage: npm run quiz:publish -- <version number>   (for example: npm run quiz:publish -- 2)");
  process.exitCode = 2;
  process.exit();
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).");
  process.exitCode = 1;
  process.exit();
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: target, error: targetError } = await db
    .from("questionnaire_versions")
    .select("id, version, status")
    .eq("version", number)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) {
    console.error(`version ${number} does not exist`);
    return 1;
  }
  if (target.status === "published") {
    console.error(`version ${number} is already published`);
    return 1;
  }

  const { data: current, error: currentError } = await db
    .from("questionnaire_versions")
    .select("version")
    .eq("status", "published")
    .maybeSingle();
  if (currentError) throw new Error(currentError.message);

  const { error } = await db.rpc("publish_questionnaire_version", { p_version: target.id });
  if (error) {
    // The function raises INVALID_SET: <rule>: <detail>, VERSION_NOT_FOUND or VERSION_ALREADY_PUBLISHED.
    console.error(error.message);
    return 1;
  }
  console.log(`published version ${number}, archived ${current ? `version ${current.version}` : "no version"}`);
  return 0;
}

// process.exitCode (not process.exit) lets Node close its network handles first: calling exit with
// them open crashes Node on Windows (exit code 0xC0000409).
main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(error instanceof Error ? error.message : "unexpected error");
    process.exitCode = 1;
  },
);
