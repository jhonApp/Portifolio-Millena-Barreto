import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/load-env.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
