import { spawn } from "node:child_process";
import nextEnv from "@next/env";

// Loads .env.local (git ignored) so the dev port lives in the env file, not in package.json.
nextEnv.loadEnvConfig(process.cwd());

const port = process.env.APP_PORT || "3000";
const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 0));
