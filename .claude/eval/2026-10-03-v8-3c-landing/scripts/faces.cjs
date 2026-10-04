// The teacher chooser's faces (V8.3c): each teacher's head, cropped from their hero still (its opaque pixels' top
// rows: the head is the top of the figure), squared, on the page's sunk tone, 96 px (36 px at 2x and a little over).
// Usage: node faces.cjs   -> public/images/landing/v3b/face-<teacher>.webp
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const PUB = path.join(__dirname, "..", "..", "..", "..", "public", "images", "landing", "v3b");

async function face(file, out) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // The head: from the first opaque row down about one head height; its middle from the opaque columns there.
  let top = -1;
  for (let y = 0; y < info.height && top < 0; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 200) { top = y; break; }
  const span = Math.round(info.height * 0.17);
  let x0 = info.width, x1 = 0;
  for (let y = top; y < top + span * 0.8; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 200) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const cx = Math.round((x0 + x1) / 2), size = Math.round(span * 1.45);
  const left = Math.max(0, cx - Math.round(size / 2)), y = Math.max(0, top - Math.round(size * 0.06));
  await sharp(file).extract({ left, top: y, width: Math.min(size, info.width - left), height: Math.min(size, info.height - y) })
    .resize(96, 96, { fit: "cover", position: "top" }).flatten({ background: "#E7E9ED" }).webp({ quality: 86 }).toFile(out);
  console.log(out);
}

(async () => {
  await face(path.join(PUB, "hero.webp"), path.join(PUB, "face-jake.webp"));
  await face(path.join(PUB, "mj", "hero.webp"), path.join(PUB, "face-mj.webp"));
})();
