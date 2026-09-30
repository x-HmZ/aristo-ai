import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { MOVES } from "./content";
import { LINE_HOLD_S, lineAt, wordState } from "./lines";
import { clockOf, reducedMotion, setPlaying, subscribeClock } from "./play";
import { host, subscribe as subscribeHost } from "./stage/host";
import type { LandingMode } from "./stage/gate";
import { isSoundOn, lineData, loadLine, setSound, speak, subscribe as subscribeSound, syncAudio, wordsSpoken } from "./stage/sound";
import { REAL } from "./ui";

/** Activate, Explain, Demonstrate: the lesson's first three moves, their first sentence each (verbatim). */
const LINES = MOVES.slice(0, 3);
/** The round enters at Explain: the line the card shows before it plays, and under reduced motion (plan, hero). */
const FIRST = 1;
/** After Jake is live, the wave plays first; the first line starts this long after. */
const START_S = 2.6;
const CLOCK = "hero-line";

const wordCount = (i: number) => LINES[i].first.split(" ").length;
/** A line's spoken length: to the end of its first sentence's last word. Unknown until its timings load. */
function lengthOf(i: number): number {
  const d = lineData(LINES[i].segment);
  const w = d?.words[wordCount(i) - 1];
  return w ? w.end + 0.15 : 0;
}

const ICON_BTN = cn(SHAPE.control, PRESS, FOCUS, "inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap px-3 text-sm font-semibold text-body hover:bg-sunk hover:text-ink");

/**
 * Jake's line card in the hero (V8.3b): the heart lesson's own lines, spoken at their real pace. Silent unless
 * "Hear it" is on: the words light from the recording's timings, and Jake's mouth follows the same timings (sound.ts).
 * Each line holds 2.5s and hands over to the next, round again; it pauses off screen, with the tab hidden, and with
 * the pause control (an autoplay longer than 5s, WCAG 2.2.2). On the full path it starts once Jake is live and has
 * waved; on the lite path once it is in view. Under reduced motion it shows the Explain line whole and never plays.
 */
export function HeroLine({ mode, className }: { mode: LandingMode | null; className?: string }) {
  const [index, setIndex] = useState(FIRST);
  const [sound, setSoundState] = useState(false);
  const [paused, setPaused] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const words = useRef<(HTMLSpanElement | null)[]>([]);
  const shown = useRef({ index: FIRST, lit: -2 });

  useEffect(() => subscribeSound(() => setSoundState(isSoundOn())), []);

  // Play while in view, ready and not paused. Ready: once the gate has run, and on the full path once Jake is live.
  useEffect(() => {
    // `?still`: the stills are captured with Jake at rest (scripts/stills.cjs in the V8.3b eval).
    if (!mode || mode === "stack" || reducedMotion() || new URLSearchParams(window.location.search).has("still")) return;
    const c = clockOf(CLOCK);
    c.length = Number.POSITIVE_INFINITY;
    for (const l of LINES) void loadLine(l.segment);
    let inView = false, ready = mode !== "full" || host.live === "hero";
    const apply = () => setPlaying(CLOCK, inView && ready && !paused);
    const io = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio >= 0.4) inView = true;
      else if (!e.isIntersecting) inView = false;
      apply();
    }, { threshold: [0, 0.4] });
    if (card.current) io.observe(card.current);
    const off = subscribeHost(() => { if (!ready && host.live === "hero") { ready = true; apply(); } });
    apply();
    return () => { io.disconnect(); off(); setPlaying(CLOCK, false); };
  }, [mode, paused]);

  // Each tick of the clock: the line and the word, the mouth (only while Jake is live here), and the sound.
  useEffect(() => {
    const paint = (lit: number, total: number) => {
      // Only the words whose state changed are touched: one word per change while a line plays.
      const prev = shown.current.lit;
      for (let k = 0; k < total; k++) {
        const s = wordState(k, lit, total);
        if (prev === -2 || s !== wordState(k, prev, total)) words.current[k]?.setAttribute("data-s", s);
      }
      shown.current.lit = lit;
    };
    const tick = () => {
      const c = clockOf(CLOCK);
      const t = c.t - START_S;
      if (t < 0 || !c.playing) {
        speak(null);
        syncAudio(null, 0, false);
        return;
      }
      const lengths = LINES.map((_, i) => lengthOf(i));
      const slot = lineAt(t, lengths, FIRST, LINE_HOLD_S);
      if (slot.index !== shown.current.index) {
        shown.current = { index: slot.index, lit: -2 };
        setIndex(slot.index);
        return; // the new line's words render first; the next tick lights them
      }
      const line = LINES[slot.index];
      const total = wordCount(slot.index);
      const speaking = slot.lineT < lengths[slot.index];
      const heard = syncAudio(speaking ? line.segment : null, slot.lineT, true);
      // With the sound on, the recording leads: the clock follows it.
      let lineT = slot.lineT;
      if (heard !== null && Math.abs(heard - lineT) > 0.05) { c.t = START_S + slot.start + heard; lineT = heard; }
      speak(speaking && host.live === "hero" ? line.segment : null, lineT);
      const d = lineData(line.segment);
      const n = speaking && d ? Math.min(total, wordsSpoken(d.words, lineT)) : total + 1;
      if (n !== shown.current.lit) paint(n, total);
    };
    return subscribeClock(CLOCK, tick);
  }, []);

  useEffect(() => () => { speak(null); syncAudio(null, 0, false); }, []);

  const line = LINES[index];
  return (
    <div ref={card} className={cn(SHAPE.surface, "z-20 border border-line bg-surface px-4 pb-4 pt-3.5 shadow-e2", className)}>
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="text-sm font-semibold text-ink">Jake</span>
        <span className="text-[13px] font-semibold text-accent-text">{line.name}</span>
        <span className="-my-2 -mr-2 ml-auto flex items-center">
          <button
            type="button"
            aria-pressed={sound}
            onClick={() => { setSound(!sound); if (!sound) setPaused(false); }}
            className={ICON_BTN}
          >
            {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
            Hear it
          </button>
          <button
            type="button"
            aria-label={paused ? "Play the line" : "Pause the line"}
            onClick={() => setPaused((p) => !p)}
            className={cn(ICON_BTN, "w-11 justify-center px-0")}
          >
            {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          </button>
        </span>
      </div>
      <p key={index} className="text-base font-medium leading-normal">
        {line.first.split(" ").map((w, k) => (
          <span key={k}>
            <span ref={(el) => { words.current[k] = el; }} data-s="on" className="landing-word">{w}</span>{" "}
          </span>
        ))}
      </p>
      <p className={cn(REAL, "mt-2")}>Real output from the heart demo lesson.</p>
    </div>
  );
}
