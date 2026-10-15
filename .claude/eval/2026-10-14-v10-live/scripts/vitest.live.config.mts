import { defineConfig } from "vitest/config";
import path from "node:path";

// Runs live.run.ts only (it makes paid Anthropic calls; never part of `yarn test`).
const root = path.resolve(__dirname, "../../../..");
export default defineConfig({
  root,
  resolve: { alias: { "@": path.join(root, "src") } },
  test: {
    environment: "node",
    include: [".claude/eval/2026-10-14-v10-live/scripts/live.run.ts"],
  },
});
