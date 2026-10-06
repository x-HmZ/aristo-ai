// V8.7 step 4: compare the production build's compiled CSS before and after the dead-code removal.
// Rules are compared as sets (a rule is its selector and its declarations), so only real differences show:
// anything added, anything removed, and the removed custom properties by name.
//   node cssdiff.cjs <beforeDir> <afterDir>
const fs = require("fs");
const path = require("path");

const [beforeDir, afterDir] = process.argv.slice(2);
const load = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");

// Split into rules at the top level and one level inside @media/@layer/@supports: a flat list of "context|rule".
function rules(css) {
  const out = [];
  const walk = (src, ctx) => {
    let depth = 0, start = 0;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const text = src.slice(start, i + 1).trim();
          start = i + 1;
          const open = text.indexOf("{");
          const head = text.slice(0, open).trim();
          const body = text.slice(open + 1, -1);
          if (/^@(media|supports|layer|container)/.test(head) && body.includes("{")) walk(body, ctx + head + " > ");
          else out.push(ctx + text);
        }
      }
    }
  };
  walk(css, "");
  return out;
}
const props = (css) => new Set([...css.matchAll(/--aristo-[a-z-]+:[^;}]+/g)].map((m) => m[0].trim()));

const B = load(beforeDir), A = load(afterDir);
const rb = new Set(rules(B)), ra = new Set(rules(A));
const removed = [...rb].filter((r) => !ra.has(r));
const added = [...ra].filter((r) => !rb.has(r));
const pb = props(B), pa = props(A);
console.log(`rules: before ${rb.size}, after ${ra.size}; removed ${removed.length}, added ${added.length}`);
console.log(`--aristo-* declarations: before ${pb.size}, after ${pa.size}; gone ${[...pb].filter((x) => !pa.has(x)).length}, new ${[...pa].filter((x) => !pb.has(x)).length}`);
console.log("\nREMOVED rules (selector only):");
for (const r of removed) console.log("  -", r.slice(0, r.indexOf("{")).slice(0, 110), r.length > 160 ? `{... ${r.length} chars}` : r.slice(r.indexOf("{")));
console.log("\nADDED rules:");
for (const r of added) console.log("  +", r.slice(0, 240));
console.log("\n--aristo-* declarations that remain:", [...pa].map((x) => x.split(":")[0]).sort().join(" "));
