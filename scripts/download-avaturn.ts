/**
 * Download an Avaturn-exported GLB and save it locally.
 *
 * Usage (after `yarn` installs deps):
 *   npx tsx scripts/download-avaturn.ts <avaturn-url> <output-name>
 *
 * Example:
 *   npx tsx scripts/download-avaturn.ts \
 *     "https://api.avaturn.me/avatars/abc123.glb" Marcus
 *
 * The output goes to `public/models/Teacher_<output-name>.glb`.
 *
 * Why this exists: the Avaturn SDK fires an `export` event with a CDN URL that
 * is auth-token-protected and time-limited. The fastest way to ship Marcus
 * and Priya as default avatars is to generate them once via /create-teacher,
 * grab the URL from the browser DevTools network log (or copy it from the
 * "saved" status in CreateTeacherClient.tsx), and run this script to bake
 * the GLB into public/models/.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

async function main() {
  const [url, name] = process.argv.slice(2);

  if (!url || !name) {
    console.error("Usage: npx tsx scripts/download-avaturn.ts <url> <name>");
    console.error("       e.g. npx tsx scripts/download-avaturn.ts https://... Marcus");
    process.exit(1);
  }

  if (!url.startsWith("https://")) {
    console.error("URL must be an https:// link");
    process.exit(1);
  }

  const outputPath = path.join(
    __dirname,
    "..",
    "public",
    "models",
    `Teacher_${name}.glb`,
  );

  console.log(`Downloading: ${url}`);
  console.log(`Saving to:   ${outputPath}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buf);

  const sizeMb = (buf.length / 1024 / 1024).toFixed(2);
  console.log(`Done — wrote ${sizeMb} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
