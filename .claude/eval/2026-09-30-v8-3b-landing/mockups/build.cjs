// Writes data.js for the V8.3b direction mockups: the real mark paths (markPaths.ts), the real KG snapshot and
// the real alignment of seg_004 (the Explain line). Run from anywhere: node build.cjs
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..", "..");
const src = fs.readFileSync(path.join(ROOT, "src/components/brand/markPaths.ts"), "utf8");
const grab = (name) => {
  const block = src.split(`export const ${name} = {`)[1].split("};")[0];
  const get = (k) => block.match(new RegExp(`${k}: "([^"]+)"`))[1];
  return { viewBox: get("viewBox"), ink: get("ink"), lit: get("lit") };
};
const kg = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/landing/kg-snapshot.json"), "utf8"));
const align = JSON.parse(fs.readFileSync(path.join(ROOT, "public/demo/heart/seg_004.align.json"), "utf8"));
const data = { mark: { wordmark: grab("WORDMARK"), column: grab("COLUMN") }, kg: { nodes: kg.nodes, edges: kg.edges }, align };
fs.writeFileSync(path.join(__dirname, "data.js"), "window.DATA = " + JSON.stringify(data) + ";\n");
console.log("data.js written", Object.keys(align).slice(0, 5));
