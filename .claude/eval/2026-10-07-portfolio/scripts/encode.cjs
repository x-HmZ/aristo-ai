// Cut a window out of a recorded session and encode it for the web: H.264 MP4 (faststart, no audio), VP9 WebM and
// a JPEG poster (the window's first frame), all the same name.
//   node encode.cjs <session> <start s> <duration s> <name> <width> <height> [crf=23]
// start is seconds from the session's first frame (the contact sheet's labels).
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const [session, startArg, durArg, name, wArg, hArg, crfArg = "23"] = process.argv.slice(2);
const DIR = path.join(__dirname, "..", "rec", session);
const OUT = path.join(__dirname, "..", "out");
fs.mkdirSync(OUT, { recursive: true });
const frames = JSON.parse(fs.readFileSync(path.join(DIR, "frames.json"), "utf8"));
const t0 = frames[0].t, a = t0 + Number(startArg), b = a + Number(durArg);
const W = Number(wArg), H = Number(hArg);
const FFMPEG = process.env.FFMPEG || "ffmpeg";

// The frame on screen at `a`, then every frame that arrives before `b`, each held until the next.
let i = frames.findIndex((f) => f.t > a);
if (i < 0) throw new Error("window past the end");
i = Math.max(0, i - 1);
const lines = [];
for (let k = i; k < frames.length && frames[k].t < b; k++) {
  const from = Math.max(frames[k].t, a);
  const until = Math.min(frames[k + 1] ? frames[k + 1].t : b, b);
  if (until <= from) continue;
  lines.push(`file '${path.join(DIR, "frames", frames[k].f).split(path.sep).join("/")}'`, `duration ${(until - from).toFixed(4)}`);
}
lines.push(lines.at(-2)); // the concat demuxer needs the last file repeated
const list = path.join(DIR, `${name}.txt`);
fs.writeFileSync(list, lines.join("\n"));

const vf = `fps=30,scale=${W}:${H}:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p`;
const mp4 = path.join(OUT, `${name}.mp4`), webm = path.join(OUT, `${name}.webm`), jpg = path.join(OUT, `${name}.jpg`);
const run = (args) => execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
run(["-f", "concat", "-safe", "0", "-i", list, "-vf", vf, "-t", durArg, "-color_range", "tv", "-c:v", "libx264", "-preset", "slow", "-crf", crfArg, "-profile:v", "high", "-movflags", "+faststart", "-an", mp4]);
run(["-i", mp4, "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-an", webm]);
// The poster is the first frame unless POSTER_AT (seconds into the clip) picks a better one.
run([...(process.env.POSTER_AT ? ["-ss", process.env.POSTER_AT] : []), "-i", mp4, "-frames:v", "1", "-q:v", "3", jpg]);
const kb = (f) => Math.round(fs.statSync(f).size / 1024);
console.log(`${name}: ${Number(durArg)} s ${W}x${H} | mp4 ${kb(mp4)} KB, webm ${kb(webm)} KB, poster ${kb(jpg)} KB`);
