import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal Vitest config for pure-logic unit tests only (no DOM, no network).
// Mirrors the `@/*` -> `src/*` path alias from tsconfig.json so test files
// can import modules the same way app code does.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
