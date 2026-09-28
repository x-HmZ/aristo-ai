// Downloads the CC0 Poly Haven models the "evening" room uses (1k glTF with its
// .bin and textures) into <dir>/<asset>/, the layout build_studio_room.py's
// --props expects. Attribution is recorded in LICENSES.md.
//
//   node scripts/room/fetch-props.mjs <dir>

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize } from "node:path";

const PROPS = ["mid_century_lounge_chair", "side_table_01", "potted_plant_04", "modern_ceiling_lamp_01"];

const [dir] = process.argv.slice(2);
if (!dir) {
  console.error("usage: node scripts/room/fetch-props.mjs <dir>");
  process.exit(1);
}

async function download(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
}

for (const id of PROPS) {
  const res = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!res.ok) throw new Error(`${res.status} files/${id}`);
  const gltf = (await res.json()).gltf?.["1k"]?.gltf;
  if (!gltf) throw new Error(`${id}: no 1k glTF`);
  await download(gltf.url, join(dir, id, `${id}_1k.gltf`));
  for (const [rel, file] of Object.entries(gltf.include ?? {})) {
    // The relative paths come from the API: never let one write outside <dir>/<id>.
    if (isAbsolute(rel) || normalize(rel).split(/[\\/]/).includes("..")) throw new Error(`${id}: unsafe path ${rel}`);
    await download(file.url, join(dir, id, rel));
  }
  console.log("fetched", id);
}
