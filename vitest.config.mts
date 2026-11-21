import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "server-only": path.resolve(import.meta.dirname, "tests/setup/server-only-stub.ts"),
    },
  },
  // The PDF document is written in JSX (the site build uses its own transform).
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    // threads and forks fail with "Cannot read properties of undefined (reading 'config')" on Vitest 5.1 + Node 24.
    pool: "vmThreads",
    include: ["tests/unit/**/*.test.ts"],
  },
});
