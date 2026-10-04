// A sheet of a track's frames nearest the given section times (track.cjs output), 5 across, with each one's marks.
// Usage: node keysheet.cjs <trackdir> <out.png> <t1> <t2> ...
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , dir, out, ...ts] = process.argv;
const r = require(path.resolve(dir, "track.json"));
const pick = ts.map(Number).map((w) => r.samples.reduce((a, s) => (Math.abs(s.t - w) < Math.abs(a.t - w) ? s : a)));
(async () => {
  const tw = 320;
  const tiles = await Promise.all(pick.map((s) => sharp(path.join(dir, s.file)).resize({ width: tw }).toBuffer()));
  const meta = await sharp(tiles[0]).metadata();
  const cols = Math.min(5, tiles.length);
  await sharp({ create: { width: tw * cols, height: meta.height * Math.ceil(tiles.length / cols), channels: 3, background: "#888" } })
    .composite(tiles.map((t, k) => ({ input: t, left: (k % cols) * tw, top: Math.floor(k / cols) * meta.height }))).png().toFile(out);
  console.log(pick.map((s) => `${s.t.toFixed(2)}:${Object.keys(s.marks).join("/")}`).join("  "));
})();
