/**
 * One-off (V8.3c): the landing classroom's three lines, spoken by each teacher. The lines are verbatim sentences of
 * the brain demo lesson (src/data/demo/brain.ts, pinned by content.test.ts), rendered through ElevenLabs'
 * `/with-timestamps`, so each mp3 comes with its character timings in one call (no separate alignment pass):
 *
 *   public/landing/voice/<teacher>/line_<n>.mp3 + line_<n>.align.json
 *
 * Jake speaks with the demo's voice (Antoni, as prerender-demo-tts.mjs "ryan"); MJ with Jessica, the female voice Hmz picked
 * from the samples.
 *
 *   node scripts/landing-voice.mjs samples           # line 1 in each candidate female voice -> .claude/eval/.../voice/
 *   node scripts/landing-voice.mjs render <teacher>  # the three lines; MJ needs --voice=<candidate>
 *   (add --dry-run to count characters and send nothing)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = path.join(ROOT, ".claude", "eval", "2026-10-03-v8-3c-landing", "voice");

export const LINES = [
  "Picture your brain as a house with four main rooms on the top floor, plus a basement.",
  "The top floor rooms are called lobes, and the basement houses the parts that keep you alive and steady without you ever noticing.",
  "Below and behind the cerebrum sit the cerebellum and the brainstem.",
];

const JAKE = "ErXwobaYiN019PkySvjV"; // Antoni, the demo's narration
// Premade voices the free tier allows (Rachel and Aria are library voices now: 402).
const FEMALE = {
  sarah:   "EXAVITQu4vr4xnSDxMaL",
  matilda: "XrExE9yKIg1WjnnlVkGX",
  jessica: "cgSgspJ2msm6clMCkdW9",
  lily:    "pFZP5JQG7iQjIQuC4Bku",
};
const MODEL_ID = "eleven_turbo_v2_5";
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75 };

for (const raw of existsSync(path.join(ROOT, ".env.local")) ? readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/) : []) {
  const eq = raw.indexOf("=");
  if (eq < 1 || raw.trim().startsWith("#")) continue;
  const key = raw.slice(0, eq).trim();
  const val = raw.slice(eq + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
  if (!(key in process.env)) process.env[key] = val;
}

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const [cmd, who] = argv.filter((a) => !a.startsWith("--"));
const voiceArg = (argv.find((a) => a.startsWith("--voice=")) ?? "").split("=")[1];

async function speak(voiceId, text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const json = await res.json();
  const audio = Buffer.from(json.audio_base64, "base64");
  const a = json.alignment;
  if (!a || !Array.isArray(a.characters)) throw new Error("no alignment in the response");
  const characters = a.characters.map((c, i) => ({ text: c, start: a.character_start_times_seconds[i], end: a.character_end_times_seconds[i] }));
  return { audio, align: { generator: "elevenlabs-with-timestamps", audioBytes: audio.length, characters } };
}

async function main() {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY missing from .env.local");
  if (cmd === "samples") {
    const chars = LINES[0].length * Object.keys(FEMALE).length;
    console.log(`${Object.keys(FEMALE).length} samples of line 1, ${chars} characters`);
    if (DRY) return;
    mkdirSync(SAMPLES, { recursive: true });
    for (const [name, id] of Object.entries(FEMALE)) {
      const { audio } = await speak(id, LINES[0]);
      writeFileSync(path.join(SAMPLES, `mj-${name}.mp3`), audio);
      console.log(`  mj-${name}.mp3`);
    }
    return;
  }
  if (cmd === "render") {
    if (who !== "jake" && who !== "mj") throw new Error("render jake | render mj --voice=<name>");
    const voiceId = who === "jake" ? JAKE : Object.hasOwn(FEMALE, voiceArg ?? "") ? FEMALE[voiceArg] : null;
    if (!voiceId) throw new Error(`MJ needs --voice= one of ${Object.keys(FEMALE).join(", ")}`);
    const chars = LINES.reduce((n, l) => n + l.length, 0);
    console.log(`${who}: 3 lines, ${chars} characters`);
    if (DRY) return;
    const out = path.join(ROOT, "public", "landing", "voice", who);
    mkdirSync(out, { recursive: true });
    for (let i = 0; i < LINES.length; i++) {
      const { audio, align } = await speak(voiceId, LINES[i]);
      writeFileSync(path.join(out, `line_${i + 1}.mp3`), audio);
      writeFileSync(path.join(out, `line_${i + 1}.align.json`), JSON.stringify(align));
      const end = align.characters.at(-1)?.end ?? 0;
      console.log(`  line_${i + 1}: ${(audio.length / 1024).toFixed(0)} kB, ${end.toFixed(2)} s`);
    }
    return;
  }
  throw new Error("usage: samples | render <jake|mj> [--voice=<name>] [--dry-run]");
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
