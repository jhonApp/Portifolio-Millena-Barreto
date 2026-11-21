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
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/load-env.ts", "tests/setup/email-simulation.ts", "tests/setup/clean-detached-orders.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
