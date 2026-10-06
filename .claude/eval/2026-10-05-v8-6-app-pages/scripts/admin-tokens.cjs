// V8.6 admin token pass, step 1: the mechanical class mapping (brand-system "Admin" in the V8.6 plan).
// Rewrites Tailwind classes in src/app/admin/** and src/components/admin/** in place, prints what is left
// for the hand pass (hex, inline colours, white text on fills, palette names it does not know).
//   node admin-tokens.cjs [--dry]
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..", "..");
const DIRS = ["src/app/admin", "src/components/admin"].map((d) => path.join(ROOT, d));
const DRY = process.argv.includes("--dry");

// Prefix: any chain of variants (hover:, group-hover:, focus-visible:, md:, data-[..]:, placeholder:).
const P = "((?:[a-z0-9-]+(?:-\\[[^\\]]+\\])?:)*)";
const O = "(?:\\/\\d+)?"; // optional opacity
const rules = [
  // Hover fills first, so the generic fill rules below cannot turn them into a no-op hover.
  [`hover:bg-white${O}`, "hover:bg-sunk"],
  [`hover:bg-aristo-(?:wash(?:-faint)?|orange-pale|orange-main\\/(?:5|10|15|20))${O}`, "hover:bg-tint"],
  // Page and surfaces.
  [`bg-aristo-(?:gradient|backdrop)`, "bg-bg"],
  [`bg-aristo-cream${O}`, "bg-surface"],
  [`bg-aristo-beige(?:-dark|-light)?${O}`, "bg-sunk"],
  [`bg-white${O}`, "bg-surface"],
  // Text.
  [`text-aristo-brown-main\\/(?:30|40|50|60)`, "text-muted"],
  [`text-aristo-brown-main\\/(?:70|80|90)`, "text-body"],
  [`text-aristo-brown-main`, "text-ink"],
  [`text-aristo-(?:brown-muted|brown-faint|tan)${O}`, "text-muted"],
  [`text-aristo-orange-(?:main|ink|deep|light)${O}`, "text-accent-text"],
  // Orange fills and washes.
  [`bg-aristo-orange-main\\/(?:5|10|15|20|25|30)`, "bg-tint"],
  [`bg-aristo-orange-main`, "bg-accent"],
  [`bg-aristo-(?:orange-pale|orange-light|wash(?:-faint)?)${O}`, "bg-tint"],
  [`border-aristo-orange-main\\/(?:10|15|20|25|30|40|50)`, "border-tint-line"],
  [`border-aristo-orange-main`, "border-accent"],
  [`(?:ring|outline)-aristo-orange-main${O}`, "ring-accent-text"],
  // Hairlines.
  [`border-(?:white|aristo-beige(?:-dark|-light)?)${O}`, "border-line"],
  [`divide-(?:white|aristo-beige(?:-dark|-light)?)${O}`, "divide-line"],
  [`shadow-aristo-lg`, "shadow-e2"],
  [`shadow-aristo(?:-sm)?`, "shadow-e1"],
  // Raw status colours onto the semantic tokens.
  [`text-(?:red|rose)-(?:500|600|700|800)`, "text-danger"],
  [`text-(?:green|emerald)-(?:500|600|700|800)`, "text-success"],
  [`text-(?:amber|yellow|orange)-(?:500|600|700|800)`, "text-warning"],
  [`text-(?:blue|sky)-(?:500|600|700|800)`, "text-info"],
  [`bg-(?:red|rose)-(?:50|100)${O}`, "bg-danger/10"],
  [`bg-(?:green|emerald)-(?:50|100)${O}`, "bg-success/10"],
  [`bg-(?:amber|yellow|orange)-(?:50|100)${O}`, "bg-warning/10"],
  [`bg-(?:blue|sky)-(?:50|100)${O}`, "bg-info/10"],
  [`border-(?:red|rose)-(?:100|200|300)${O}`, "border-danger/25"],
  [`border-(?:green|emerald)-(?:100|200|300)${O}`, "border-success/25"],
  [`border-(?:amber|yellow|orange)-(?:100|200|300)${O}`, "border-warning/25"],
  [`border-(?:blue|sky)-(?:100|200|300)${O}`, "border-info/25"],
  [`bg-(?:red|rose)-(?:500|600)`, "bg-danger"],
  [`bg-(?:green|emerald)-(?:500|600)`, "bg-success"],
  // Neutral greys.
  [`text-(?:slate|gray|zinc|neutral)-(?:400|500|600)`, "text-muted"],
  [`text-(?:slate|gray|zinc|neutral)-(?:700|800|900)`, "text-ink"],
  [`bg-(?:slate|gray|zinc|neutral)-(?:50|100)${O}`, "bg-sunk"],
  [`border-(?:slate|gray|zinc|neutral)-(?:100|200|300)${O}`, "border-line"],
].map(([re, to]) => [new RegExp(`(^|[\\s"'\`{(])${P}${re}(?=$|[\\s"'\`})])`, "g"), to]);

const LEFT = /aristo-[a-z-]+|#[0-9a-fA-F]{3,6}\b|BRAND_HEX|text-white|(?:bg|text|border|ring)-(?:red|green|amber|yellow|orange|blue|sky|violet|purple|slate|gray|emerald|rose|teal|cyan|indigo)-\d+/g;

const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(tsx|ts|jsx)$/.test(f)) files.push(p); } };
DIRS.forEach(walk);
let changed = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  let out = src;
  for (const [re, to] of rules) out = out.replace(re, (_m, lead, pre) => `${lead}${pre}${to}`);
  if (out !== src) { changed++; if (!DRY) fs.writeFileSync(f, out); }
  const left = [...new Set(out.match(LEFT) || [])];
  if (left.length) console.log(path.relative(ROOT, f) + ": " + left.join(" "));
}
console.log(`${changed} files ${DRY ? "would change" : "changed"}`);
