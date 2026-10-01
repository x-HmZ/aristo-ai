import { useEffect, useRef, type RefObject } from "react";
import { clockOf } from "../play";
import { host, subscribe } from "../stage/host";
import { MOVES_T, moveBeatAt } from "../stage/scripts";
import { shared } from "../stage/shared";

type P = { x: number; y: number };

/** A wrist above this (world y) is up in a gesture; at rest it hangs at about -0.45. */
const UP = -0.3;
/**
 * Imagine and HoldIdea bring both wrists to about 0.05 to 0.2 and hold them there: above HELD they are holding, and
 * below LET_GO they are on the way down. (They overshoot and settle by a few cm, which must not count as letting go.)
 */
const HELD = -0.02;
const LET_GO = -0.08;
/** Activate's rings stay where his hands left them this long, then fade. */
const LINGER_S = 0.9;
/** Sizes on the page, px: the rings (what you know), a step, the idea in Connect, the gap between steps. */
const RING = 26;
const STEP = 20;
const DOT = 30;
const STEP_GAP = 46;
/** The question card's height (fixed, so it is never measured per frame). */
const CARD_H = 126;
/** A thing set down under a hand sits this far below the hand's lowest point (its fingertips or the chop's edge). */
const CLEAR = 4;
/** The idea between the palms in Explain: this share of the gap between them (as in A Teacher of Your Own). */
const ORB_OF_GAP = 0.62;
const FADE_S = 0.45;

const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

interface State {
  run: number;
  index: number;
  /** Activate: a ring under each palm, and when the spread peaked (they stay there), in performance seconds. */
  rings: (P | null)[];
  wide: { min: number; gap: number; at: number | null };
  /** Explain: the orb's size, where it is, and when it appeared. */
  orb: { size: number; at: P; since: number } | null;
  /** Demonstrate: where the last chop landed, how many steps have landed, and the step the raised hand is for. */
  land: P | null;
  steps: number;
  armed: number;
  still: number;
  last: P | null;
  /** Challenge: the card follows the palms while they are up. */
  card: { at: P; w: number } | null;
  /** Connect: the widest gap while the hands close, and when the third ring (what comes next) appeared. */
  joinMax: number;
  joined: number | null;
  /** When the current move's graphic started to fade (performance seconds), or null while it is held. */
  out: number | null;
  /** When the steps started to fade (they stay into Challenge until its hands are up). */
  stepsOut: number | null;
  /** Each step's shown position, eased towards its place in the chain. */
  stepAt: P[];
}

const fresh = (run: number): State => ({
  run, index: -1, rings: [null, null], wide: { min: Infinity, gap: 0, at: null }, orb: null, land: null, steps: 0, armed: -1,
  still: 0, last: null, card: null, joinMax: 0, joined: null, out: null, stepsOut: null, stepAt: [],
});

/**
 * What Jake holds or sets down at each of the five moves (V8.3b), placed every frame from his palms as the stage
 * reports them (shared.hands, read from his bones), so each gesture lands on its thing at his scale:
 * - Activate (Imagine, palms down, spreading): rings of light, what you already know, set down under his palms;
 * - Explain (HoldIdea): the idea, an orb of light between his palms;
 * - Demonstrate (StepBeat, three chops): each chop lands a step under his hand, and the steps chain up;
 * - Challenge (YourTurn, palms up, offered): the question card, paper, resting on his palms;
 * - Connect (BringTogether): what you know in one hand and the idea in the other, linked as his hands close, and
 *   what comes next lights above them.
 * Each one fades once his hands are down. Only on the live path; nothing is drawn where his hands are not.
 */
export function MovesHands({ wrap }: { wrap: RefObject<HTMLDivElement | null> }) {
  const rings = useRef<(HTMLSpanElement | null)[]>([]);
  const orb = useRef<HTMLSpanElement>(null);
  const steps = useRef<(HTMLSpanElement | null)[]>([]);
  const stepLinks = useRef<(HTMLSpanElement | null)[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const join = useRef<(HTMLSpanElement | null)[]>([]);
  const joinLinks = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let st = fresh(-1);
    // Sizes are always given (never read back from the page), so a frame writes styles and reads no layout.
    const put = (el: HTMLElement | null | undefined, p: P | null, o: number, ww: number, hh: number, size = false) => {
      if (!el) return;
      if (!p || o <= 0.01) { if (el.style.opacity !== "0") el.style.opacity = "0"; return; }
      if (size) { el.style.width = `${ww}px`; el.style.height = `${hh}px`; }
      el.style.opacity = String(o);
      el.style.transform = `translate3d(${p.x - ww / 2}px, ${p.y - hh / 2}px, 0)`;
    };
    /** A link from a to b, `k` of the way drawn (a 2px bar rotated onto the line, from a). */
    const link = (el: HTMLElement | null | undefined, a: P, b: P, k: number, o: number) => {
      if (!el) return;
      if (k <= 0.01 || o <= 0.01) { if (el.style.opacity !== "0") el.style.opacity = "0"; return; }
      const len = dist(a, b);
      el.style.opacity = String(o);
      el.style.width = `${len}px`;
      el.style.transform = `translate3d(${a.x}px, ${a.y - 1}px, 0) rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad) scaleX(${k})`;
    };
    const hideAll = () => {
      [...rings.current, orb.current, ...steps.current, ...stepLinks.current, card.current, ...join.current, ...joinLinks.current]
        .forEach((el) => { if (el && el.style.opacity !== "0") el.style.opacity = "0"; });
    };

    const frame = () => {
      const box = wrap.current?.getBoundingClientRect();
      const c = clockOf("moves");
      const beat = moveBeatAt(c.t);
      const hands = shared.hands;
      if (!box || hands.spot !== "moves" || !hands.palms) { hideAll(); return; }
      if (c.run !== st.run || (beat?.index ?? -1) < st.index) { st = fresh(c.run); hideAll(); }
      const now = performance.now() / 1000;
      const index = beat?.index ?? -1;
      if (index !== st.index) {
        // A new move: the last one's graphic goes (the steps stay until Challenge's hands are up).
        if (beat?.move !== "challenge") hideAll();
        st.index = index;
        st.out = null;
      }
      if (!beat) return;
      // His palms in the section's own box (his right hand is on screen left, his left on screen right).
      const L: P = { x: hands.palms.l.x - box.left, y: hands.palms.l.y - box.top };
      const R: P = { x: hands.palms.r.x - box.left, y: hands.palms.r.y - box.top };
      // Each hand's lowest point (a fingertip, the thumb), for what sits under it.
      const lowL: P = hands.low ? { x: hands.low.l.x - box.left, y: hands.low.l.y - box.top } : L;
      const lowR: P = hands.low ? { x: hands.low.r.x - box.left, y: hands.low.r.y - box.top } : R;
      const upL = hands.lift.l > UP, upR = hands.lift.r > UP, both = upL && upR;
      const gap = dist(L, R), m = mid(L, R);
      const fade = () => {
        if (st.out === null) st.out = now;
        return clamp01(1 - (now - st.out) / FADE_S);
      };

      switch (beat.move) {
        case "activate": {
          // A ring under each palm while his hands spread out, palms down, as if laying out what you know. Where the
          // spread peaks (his hands start back), they stay, and fade a moment later.
          const out = hands.lift.l > HELD && hands.lift.r > HELD;
          if (st.wide.at === null && out) {
            st.rings = [{ x: R.x, y: lowR.y + CLEAR + RING / 2 }, { x: L.x, y: lowL.y + CLEAR + RING / 2 }];
            // (His hands come in a little before they spread: the peak counts only after a real spread.)
            st.wide.min = Math.min(st.wide.min, gap);
            if (gap > st.wide.gap) st.wide.gap = gap;
            else if (st.wide.gap > st.wide.min + 80 && gap < st.wide.gap - 6) st.wide.at = now;
          }
          if (st.wide.at === null && st.rings[0] && !out) st.wide.at = now;
          let o = st.rings[0] ? 1 : 0;
          if (st.wide.at !== null && now - st.wide.at > LINGER_S) o = fade();
          st.rings.forEach((p, i) => put(rings.current[i], p, o, RING, RING));
          break;
        }
        case "explain": {
          if (!st.orb && hands.lift.l > HELD && hands.lift.r > HELD) st.orb = { size: gap * ORB_OF_GAP, at: m, since: now };
          let o = 0;
          if (st.orb) {
            const held = hands.lift.l > LET_GO && hands.lift.r > LET_GO && st.out === null;
            if (held) {
              st.orb.size = gap * ORB_OF_GAP;
              st.orb.at = m;
              o = clamp01((now - st.orb.since) / 0.25);
            } else o = fade();
          }
          const s = st.orb ? st.orb.size * (0.7 + 0.3 * o) : 0;
          put(orb.current, st.orb?.at ?? null, o, s, s, true);
          break;
        }
        case "demonstrate": {
          // Each step: his right hand rises above his shoulder line, then the chop stops and holds: it has landed.
          if (beat.step >= st.steps && hands.lift.r > -0.1) st.armed = beat.step;
          const speed = st.last ? dist(R, st.last) : 99;
          st.last = R;
          st.still = speed < 1.2 ? st.still + 1 : 0;
          if (st.armed === beat.step && st.steps === beat.step && upR && hands.lift.r < 0 && st.still >= 2) {
            st.land = { x: lowR.x, y: lowR.y + CLEAR + STEP / 2 };
            st.steps = beat.step + 1;
            st.armed = -1;
          }
          // A chop that never came (the clip pack not loaded yet) still lights its step, once a place is known.
          if (st.land && st.steps === beat.step && c.t >= MOVES_T.steps[beat.step] + 1.4) st.steps = beat.step + 1;
          drawSteps(1);
          break;
        }
        case "challenge": {
          if ((both || st.card) && st.stepsOut === null) st.stepsOut = now;
          drawSteps(st.stepsOut === null ? 1 : clamp01(1 - (now - st.stepsOut) / FADE_S));
          if (both) {
            // Its bottom corners rest on his palms: each palm a little inside a corner.
            st.card = { at: m, w: Math.max(170, Math.min(270, gap + 24)) };
            put(card.current, { x: m.x, y: m.y - 2 - CARD_H / 2 }, 1, st.card.w, CARD_H, true);
          } else if (st.card) {
            const o = fade();
            put(card.current, { x: st.card.at.x, y: st.card.at.y - 2 - CARD_H / 2 + (1 - o) * 12 }, o, st.card.w, CARD_H, true);
          }
          break;
        }
        case "connect": {
          // What you know rides in his right hand (screen left), the idea in his left, each on the inner side of
          // its palm; the link draws as his hands close, and what comes next lights above once they are near.
          const held = both && st.out === null;
          if (held) st.joinMax = Math.max(st.joinMax, gap);
          const k = st.joinMax > 0 ? clamp01((st.joinMax - gap) / (st.joinMax * 0.5)) : 0;
          if (held && k >= 0.95 && st.joined === null) st.joined = now;
          const o = held ? 1 : st.joinMax > 0 ? fade() : 0;
          if (o <= 0.01 && !held) { hideAll(); break; }
          const ux = (L.x - R.x) / (gap || 1), uy = (L.y - R.y) / (gap || 1);
          const a: P = { x: R.x + ux * (RING / 2 + 6), y: R.y + uy * (RING / 2 + 6) };
          const b: P = { x: L.x - ux * (DOT / 2 + 6), y: L.y - uy * (DOT / 2 + 6) };
          put(join.current[0], a, o, RING, RING);
          put(join.current[1], b, o, DOT, DOT);
          const ea: P = { x: a.x + ux * (RING / 2), y: a.y + uy * (RING / 2) };
          const eb: P = { x: b.x - ux * (DOT / 2), y: b.y - uy * (DOT / 2) };
          link(joinLinks.current[0], ea, eb, held ? k : 1, o);
          const n = st.joined === null ? 0 : clamp01((now - st.joined) / 0.4);
          const next: P = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 64 };
          put(join.current[2], next, o * n, RING, RING);
          link(joinLinks.current[1], a, next, n, o * 0.9);
          link(joinLinks.current[2], b, next, n, o * 0.9);
          break;
        }
      }

      function drawSteps(o: number) {
        if (!st.land) return;
        for (let j = 0; j < 3; j++) {
          if (j >= st.steps) {
            delete st.stepAt[j];
            put(steps.current[j], null, 0, STEP, STEP);
            if (j > 0) link(stepLinks.current[j - 1], st.land, st.land, 0, 0);
            continue;
          }
          const target: P = { x: st.land.x - (st.steps - 1 - j) * STEP_GAP, y: st.land.y };
          // A step appears where its chop landed; the ones before slide out from under his hand to make room.
          const cur = st.stepAt[j] ?? target;
          st.stepAt[j] = { x: cur.x + (target.x - cur.x) * 0.18, y: cur.y + (target.y - cur.y) * 0.18 };
          put(steps.current[j], st.stepAt[j], o, STEP, STEP);
          if (j > 0) {
            const p0 = st.stepAt[j - 1], p1 = st.stepAt[j];
            link(stepLinks.current[j - 1], { x: p0.x + STEP / 2, y: p0.y }, { x: p1.x - STEP / 2, y: p1.y }, 1, o);
          }
        }
      }
    };

    // The stage calls this each frame it renders him here, after reading his bones (shared.hands.onReport).
    shared.hands.onReport = frame;
    const off = subscribe(() => { if (host.live !== "moves" || !host.onScreen) hideAll(); });
    return () => { off(); if (shared.hands.onReport === frame) shared.hands.onReport = null; };
  }, [wrap]);

  const base = "pointer-events-none absolute left-0 top-0 z-20";
  return (
    <div aria-hidden>
      {[0, 1].map((i) => (
        <span key={`r${i}`} ref={(el) => { rings.current[i] = el; }} data-track={`ring${i}`} className={`${base} landing-move-ring`} style={{ width: RING, height: RING, opacity: 0 }} />
      ))}
      <span ref={orb} data-track="orb" className={`${base} landing-orb rounded-full`} style={{ opacity: 0 }} />
      {[0, 1].map((i) => (
        <span key={`sl${i}`} ref={(el) => { stepLinks.current[i] = el; }} className={`${base} landing-move-link origin-left`} style={{ opacity: 0 }} />
      ))}
      {[0, 1, 2].map((i) => (
        <span key={`s${i}`} ref={(el) => { steps.current[i] = el; }} data-track={`step${i}`} className={`${base} landing-move-dot`} style={{ width: STEP, height: STEP, opacity: 0 }} />
      ))}
      <div ref={card} data-track="card" className={`${base} theme-paper landing-move-card overflow-hidden rounded-2xl border border-line bg-surface px-4 py-3.5 text-ink`} style={{ height: CARD_H, opacity: 0 }}>
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-accent-text">Your turn</span>
        <span className="mt-1 block font-[650] leading-none text-ink" style={{ fontSize: 34 }}>?</span>
        <span className="mt-2.5 flex items-center gap-1 rounded-[8px] border border-line px-2 py-1.5 text-[12px] text-muted">
          <span className="landing-caret" />
          Your answer
        </span>
      </div>
      {[0, 1, 2].map((i) => (
        <span key={`jl${i}`} ref={(el) => { joinLinks.current[i] = el; }} className={`${base} landing-move-link origin-left`} style={{ opacity: 0 }} />
      ))}
      <span ref={(el) => { join.current[0] = el; }} data-track="known" className={`${base} landing-move-ring`} style={{ width: RING, height: RING, opacity: 0 }} />
      <span ref={(el) => { join.current[1] = el; }} data-track="idea" className={`${base} landing-move-dot`} style={{ width: DOT, height: DOT, opacity: 0 }} />
      <span ref={(el) => { join.current[2] = el; }} data-track="next" className={`${base} landing-move-ring`} style={{ width: RING, height: RING, opacity: 0 }} />
    </div>
  );
}
