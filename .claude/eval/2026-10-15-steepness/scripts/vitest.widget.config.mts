import { defineConfig } from "vitest/config";
import path from "node:path";

// Runs widget.run.ts only (paid Anthropic and fal calls; never part of `yarn test`).
const root = path.resolve(__dirname, "../../../..");
export default defineConfig({
  root,
  resolve: { alias: { "@": path.join(root, "src") } },
  test: {
    environment: "node",
    include: [".claude/eval/2026-10-15-steepness/scripts/widget.run.ts"],
  },
});
