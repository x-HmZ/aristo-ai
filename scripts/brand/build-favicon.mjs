// Writes src/app/favicon.ico: the 16px-grid column (see build-mark.mjs) on the
// dark landing ink, at 16, 32 and 48px, as a PNG-in-ICO. The .ico is the
// fallback for browsers that ignore src/app/icon.svg, and it cannot follow the
// OS theme, so it carries its own dark tile.
//
//   node scripts/brand/build-favicon.mjs [outFile]

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const BG = [0x0e, 0x11, 0x17];
const INK = [0xec, 0xed, 0xef];
const LIT = [0xe9, 0x8a, 0x52];

// The same rectangles as COLUMN_16 in markPaths.ts: [x, y, w, h, colour].
const RECTS = [
  [2, 1, 12, 2, INK],
  [4, 4, 2, 8, INK],
  [10, 4, 2, 8, INK],
  [2, 13, 12, 2, INK],
  [7, 4, 2, 8, LIT],
];

function crc32(buf) {
  let c;
  let crc = ~0;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function png(px) {
  const scale = px / 16;
  const rows = [];
  for (let y = 0; y < px; y++) {
    const row = Buffer.alloc(1 + px * 4); // filter byte 0
    for (let x = 0; x < px; x++) {
      let colour = BG;
      for (const [rx, ry, rw, rh, c] of RECTS) {
        if (x >= rx * scale && x < (rx + rw) * scale && y >= ry * scale && y < (ry + rh) * scale) colour = c;
      }
      row.set([...colour, 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const sizes = [16, 32, 48];
const images = sizes.map(png);
const head = Buffer.alloc(6);
head.writeUInt16LE(1, 2); // type: icon
head.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = sizes.map((px, i) => {
  const e = Buffer.alloc(16);
  e[0] = px;
  e[1] = px;
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bit depth
  e.writeUInt32LE(images[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += images[i].length;
  return e;
});

const out = process.argv[2] ?? "src/app/favicon.ico";
writeFileSync(out, Buffer.concat([head, ...entries, ...images]));
console.log(`wrote ${out} (${offset} bytes)`);
