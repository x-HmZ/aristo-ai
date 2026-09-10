/**
 * One-off script: pre-renders ElevenLabs narration for the frozen /demo lessons.
 *
 * Writes public/demo/<slug>/<seg_id>.mp3 plus a per-slug audio.json manifest.
 * The /demo route then plays real audio files instead of window.speechSynthesis,
 * which also restores viseme lipsync (speechSynthesis exposes no audio buffer,
 * so the teacher's mouth does not move on the demo today).
 *
 * Deliberately dependency-free plain Node ESM: no tsx, no dotenv, no build step.
 * Reads .env.local itself and parses the frozen lesson data with a regex, so it
 * runs anywhere `node` runs.
 *
 *   node scripts/prerender-demo-tts.mjs --dry-run   # count characters, spend nothing
 *   node scripts/prerender-demo-tts.mjs             # render missing segments
 *   node scripts/prerender-demo-tts.mjs --voice=priya --force
 *
 *   node scripts/prerender-demo-tts.mjs --align            # character timings for lipsync
 *   node scripts/prerender-demo-tts.mjs --align --dry-run  # estimate, send nothing
 *
 * Safe to re-run: existing mp3s are skipped unless --force is passed, so an
 * interrupted run resumes without paying for the segments it already rendered.
 *
 * --align is a separate, cheaper pass over audio that ALREADY EXISTS. It sends
 * each mp3 plus its text to ElevenLabs' Forced Alignment endpoint and writes
 * <seg_id>.align.json beside the mp3, giving the client real character timings
 * to drive the avatar's visemes from instead of wawa-lipsync's FFT guess.
 *
 * Crucially it does NOT re-synthesize: Forced Alignment is billed at
 * speech-to-text rates (audio minutes), not TTS characters, so aligning the
 * whole demo costs nothing against the 10,000 chars/month TTS tier. Re-rendering
 * through /with-timestamps would have cost the full character count again.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT   = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Keep in sync with DEMO_TOPICS in src/data/demo/index.ts. "black-holes" was
// retired on 2026-09-10 (its 3D model reconstructed as a flat sliver; a black
// hole is light, not a surface) and replaced by "heart".
const SLUGS  = ["heart", "volcano-eruption"];

// Mirrors EL_VOICES in src/app/api/tts/route.ts. Default is "ryan" because that
// is useAristoStore's default teacher, i.e. the avatar the demo actually renders.
const EL_VOICES = {
  marcus: "pNInz6obpgDQGcFmaJgB", // Adam   - deep, clear male
  ryan:   "ErXwobaYiN019PkySvjV", // Antoni - warm, natural male
  priya:  "21m00Tcm4TlvDq8ikWAM", // Rachel - calm, expressive female
  sonia:  "EXAVITQu4vr4xnSDxMaL", // Sarah  - soft, clear female
};
const MODEL_ID       = "eleven_turbo_v2_5";
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75 };

// ─── args ────────────────────────────────────────────────────────────────────
const argv    = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const ALIGN   = argv.includes("--align");
const FORCE   = argv.includes("--force");
const voiceArg = (argv.find((a) => a.startsWith("--voice=")) || "--voice=ryan").split("=")[1];

if (!EL_VOICES[voiceArg]) {
  console.error(`Unknown voice "${voiceArg}". Options: ${Object.keys(EL_VOICES).join(", ")}`);
  process.exit(1);
}
const VOICE_ID = EL_VOICES[voiceArg];

// ─── env ─────────────────────────────────────────────────────────────────────
function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val   = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

// ─── extract narration ───────────────────────────────────────────────────────
/**
 * The frozen lesson modules are `export const lesson: LessonPayload = { ...JSON }`,
 * so the segments array is plain JSON. Slice it out and JSON.parse rather than
 * pulling in a TypeScript loader.
 */
function readSegments(slug) {
  const file = path.join(ROOT, "src", "data", "demo", `${slug}.ts`);
  const src  = readFileSync(file, "utf8");

  const key = '"segments":';
  const at  = src.indexOf(key);
  if (at === -1) throw new Error(`no "segments" key in ${file}`);

  const start = src.indexOf("[", at);
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "[") depth++;
    else if (c === "]" && --depth === 0) { end = i + 1; break; }
  }
  if (end === -1) throw new Error(`unterminated segments array in ${file}`);

  return JSON.parse(src.slice(start, end))
    .filter((s) => s && typeof s.id === "string" && typeof s.text === "string" && s.text.trim())
    .map((s) => ({ id: s.id, text: s.text.trim() }));
}

// ─── ElevenLabs ──────────────────────────────────────────────────────────────
async function synthesize(text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key":   process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept:         "audio/mpeg",
    },
    body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Character-level timings for an mp3 that already exists.
 *
 * Returns the payload written to <seg_id>.align.json. `audioBytes` is recorded
 * so a later run can tell that the mp3 was re-rendered and the timings no
 * longer describe it; `generator` is what the client checks before trusting a
 * file (see parseAlignment in src/lib/lipsync/visemes.ts), so a hand-made
 * placeholder degrades to the FFT path instead of driving the mouth from
 * invented numbers.
 */
async function alignSegment(mp3Path, text) {
  const audio = readFileSync(mp3Path);

  const fd = new FormData();
  fd.append("file", new Blob([audio], { type: "audio/mpeg" }), path.basename(mp3Path));
  fd.append("text", text);

  const res = await fetch("https://api.elevenlabs.io/v1/forced-alignment", {
    method:  "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    body:    fd,
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }

  const json = await res.json();
  if (!Array.isArray(json.characters) || json.characters.length === 0) {
    throw new Error("alignment response contained no characters");
  }

  return {
    generator:  "elevenlabs-forced-alignment",
    audioBytes: audio.length,
    loss:       json.loss,
    characters: json.characters.map((c) => ({ text: c.text, start: c.start, end: c.end })),
  };
}

/** True if an .align.json on disk is real, complete, and still matches its mp3. */
function alignmentIsCurrent(alignFile, mp3File) {
  if (!existsSync(alignFile)) return false;
  try {
    const j = JSON.parse(readFileSync(alignFile, "utf8"));
    if (typeof j.generator !== "string" || !j.generator.startsWith("elevenlabs")) return false;
    if (!Array.isArray(j.characters) || j.characters.length === 0) return false;
    // The mp3 was re-rendered since these timings were made.
    if (j.audioBytes !== statSync(mp3File).size) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── main ────────────────────────────────────────────────────────────────────
const plan = SLUGS.map((slug) => {
  const outDir   = path.join(ROOT, "public", "demo", slug);
  const segments = readSegments(slug).map((s) => {
    const file      = path.join(outDir, `${s.id}.mp3`);
    const exists    = existsSync(file) && statSync(file).size > 0;
    const alignFile = path.join(outDir, `${s.id}.align.json`);
    const aligned   = exists && alignmentIsCurrent(alignFile, file);
    return {
      ...s, file, exists, alignFile, aligned,
      willRender: FORCE || !exists,
      // Only audio that exists can be aligned.
      willAlign:  exists && (FORCE || !aligned),
    };
  });
  return { slug, outDir, segments };
});

// ─── --align: character timings for audio that already exists ────────────────
if (ALIGN) {
  const withAudio = plan.flatMap((p) => p.segments.filter((s) => s.exists));
  const toAlign   = withAudio.filter((s) => s.willAlign);
  // ElevenLabs renders mp3 at 128 kbps, so bytes/16000 approximates seconds
  // closely enough to size the bill before committing to it.
  const seconds   = toAlign.reduce((n, s) => n + statSync(s.file).size / 16000, 0);

  for (const p of plan) {
    const have    = p.segments.filter((s) => s.exists).length;
    const pending = p.segments.filter((s) => s.willAlign).length;
    console.log(`  ${p.slug.padEnd(18)} ${have} with audio, ${pending} to align`);
  }
  console.log(`to align now   : ${toAlign.length} segments, ~${(seconds / 60).toFixed(1)} min of audio`);
  console.log("NOTE: Forced Alignment bills at speech-to-text rates (audio minutes).");
  console.log("      It does NOT touch the TTS character quota and does not re-synthesize.");

  const missingAudio = plan.flatMap((p) => p.segments.filter((s) => !s.exists));
  if (missingAudio.length) {
    console.log(`\n${missingAudio.length} segment(s) have no mp3 yet — render them first, then re-run --align.`);
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: nothing sent, nothing written.");
    process.exit(0);
  }
  if (!toAlign.length) {
    console.log("\nNothing to do — every rendered segment already has current timings. Use --force to redo.");
    process.exit(0);
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("\nELEVENLABS_API_KEY not found in environment or .env.local");
    process.exit(1);
  }

  let done = 0;
  for (const p of plan) {
    for (const seg of p.segments) {
      if (!seg.willAlign) continue;
      process.stdout.write(`  ${p.slug}/${seg.id} ... `);
      try {
        const payload = await alignSegment(seg.file, seg.text);
        writeFileSync(seg.alignFile, JSON.stringify(payload) + "\n");
        done++;
        console.log(`${payload.characters.length} chars, loss ${Number(payload.loss).toFixed(3)}`);
      } catch (err) {
        console.log("FAILED");
        console.error(`\n${err.message}`);
        console.error("Stopping. Alignments already written are kept — re-run to resume from here.");
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    // Record which segments have timings so the client knows what to fetch.
    const manifestPath = path.join(p.outDir, "audio.json");
    const manifest = existsSync(manifestPath)
      ? JSON.parse(readFileSync(manifestPath, "utf8"))
      : { voice: voiceArg, model: MODEL_ID, segments: [] };
    manifest.aligned = p.segments
      .filter((s) => alignmentIsCurrent(s.alignFile, s.file))
      .map((s) => s.id);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }

  console.log(`\nDone. ${done} alignment file(s) written.`);
  console.log("Commit public/demo/*/*.align.json and the updated audio.json, then redeploy.");
  process.exit(0);
}

const todo      = plan.flatMap((p) => p.segments.filter((s) => s.willRender));
const todoChars = todo.reduce((n, s) => n + s.text.length, 0);
const allChars  = plan.flatMap((p) => p.segments).reduce((n, s) => n + s.text.length, 0);

console.log(`voice          : ${voiceArg} (${VOICE_ID})`);
console.log(`model          : ${MODEL_ID}`);
for (const p of plan) {
  const pending = p.segments.filter((s) => s.willRender).length;
  console.log(`  ${p.slug.padEnd(18)} ${p.segments.length} segments, ${pending} to render`);
}
console.log(`total narration: ${allChars} chars across ${plan.flatMap((p) => p.segments).length} segments`);
console.log(`to render now  : ${todoChars} chars across ${todo.length} segments`);
console.log("NOTE: ElevenLabs bills per character sent. Free tier is 10,000 chars/month.");

if (DRY_RUN) {
  console.log("\n--dry-run: nothing sent, nothing written.");
  process.exit(0);
}
if (!todo.length) {
  console.log("\nNothing to do — every segment already has an mp3. Use --force to re-render.");
  process.exit(0);
}
if (!process.env.ELEVENLABS_API_KEY) {
  console.error("\nELEVENLABS_API_KEY not found in environment or .env.local");
  process.exit(1);
}

let rendered = 0, bytes = 0;
for (const p of plan) {
  mkdirSync(p.outDir, { recursive: true });

  for (const seg of p.segments) {
    if (!seg.willRender) continue;
    process.stdout.write(`  ${p.slug}/${seg.id} (${seg.text.length} chars) ... `);
    try {
      const buf = await synthesize(seg.text);
      writeFileSync(seg.file, buf);
      rendered++; bytes += buf.length;
      console.log(`${(buf.length / 1024).toFixed(0)} KB`);
    } catch (err) {
      console.log("FAILED");
      console.error(`\n${err.message}`);
      console.error("Stopping. Already-written mp3s are kept — re-run to resume from here.");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 250)); // stay clear of rate limits
  }

  // Manifest of segments that have audio, so the client can fall back per segment.
  const have = p.segments
    .filter((s) => existsSync(s.file) && statSync(s.file).size > 0)
    .map((s) => s.id);
  writeFileSync(
    path.join(p.outDir, "audio.json"),
    JSON.stringify({ voice: voiceArg, model: MODEL_ID, segments: have }, null, 2) + "\n",
  );
}

console.log(`\nDone. ${rendered} mp3s, ${(bytes / 1024 / 1024).toFixed(1)} MB, ${todoChars} chars billed.`);
console.log("Commit public/demo/*/ *.mp3 and audio.json, then redeploy.");
