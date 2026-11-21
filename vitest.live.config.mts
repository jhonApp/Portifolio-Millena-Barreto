import { defineConfig } from "vitest/config";
import path from "node:path";

// Live checks call real providers. They never run with the default or integration suites.
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
    include: ["tests/live/**/*.live.test.ts"],
    setupFiles: ["tests/setup/load-env.ts"],
    testTimeout: 30000,
    fileParallelism: false,
  },
});
