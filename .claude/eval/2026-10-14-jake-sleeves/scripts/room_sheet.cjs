// Jake cropped from the /demo room shots (room.cjs), before beside after, one row per lesson moment.
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const R = path.join(__dirname, "..", "room");
const SHOTS = ["demo-1-activate-narrating", "demo-2-image-pointing", "demo-3-demonstrate", "demo-4-challenge", "demo-5-connect"];
const box = { left: 330, top: 260, width: 500, height: 620 };
const label = (w, h, s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff"/><text x="8" y="24" style="font:700 18px system-ui,sans-serif;fill:#1b1b1b">${s}</text></svg>`);
(async () => {
  const comp = [{ input: label(500, 34, "before (shipped)"), left: 0, top: 0 }, { input: label(500, 34, "after (tailored)"), left: 504, top: 0 }];
  for (const [i, s] of SHOTS.entries()) for (const [j, k] of ["before", "after"].entries()) {
    comp.push({ input: await sharp(path.join(R, k, `${s}-1920-light.jpg`)).extract(box).toBuffer(), left: j * 504, top: 34 + i * 624 });
  }
  await sharp({ create: { width: 1004, height: 34 + SHOTS.length * 624, channels: 3, background: "#fff" } }).composite(comp).jpeg({ quality: 84 })
    .toFile(path.join(__dirname, "..", "sheets", "room-before-after.jpg"));
  console.log("ok");
})();
