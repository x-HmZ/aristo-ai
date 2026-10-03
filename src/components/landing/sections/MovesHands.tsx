import { useEffect, useRef, type RefObject } from "react";
import { clockOf } from "../play";
import { host, subscribe } from "../stage/host";
import { MOVES_T, moveBeatAt } from "../stage/scripts";
import { shared } from "../stage/shared";
import { BOARD_LINKS, BOARD_NODES, type BoardNode } from "./MovesBoard";

type P = { x: number; y: number };

/** A wrist above this (world y) is up in a gesture; at rest it hangs at about -0.45. */
const UP = -0.3;
/**
 * Imagine and HoldIdea bring both wrists to about 0.05 to 0.2 and hold them there: above HELD they are holding, and
 * below LET_GO they are on the way down. (They overshoot and settle by a few cm, which must not count as letting go.)
 */
const HELD = -0.02;
const LET_GO = -0.08;
/** Sizes on the page, px: the rings, a step, the idea in Connect. */
const RING = 22;
const STEP = 18;
const DOT = 24;
/** The question card (fixed, so it is never measured per frame). */
const CARD_H = 112;
/** A thing set down under a hand sits this far below the hand's lowest point (its fingertips or the chop's edge). */
const CLEAR = 4;
/** The idea between the palms in Explain: this share of the gap between them (as in A Teacher of Your Own). */
const ORB_OF_GAP = 0.62;
/** A piece waits this long where his hands left it, then flies to its place on the board in FLY_S. */
const REST_S = 0.3;
const FLY_S = 0.7;

const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Which board places each move fills, in order (a move that never got its gesture still fills them as it ends). */
const FILLS: BoardNode[][] = [["k0", "k1"], ["idea"], ["s0", "s1", "s2"], ["q"], ["next"]];

/** A piece in his hands, then on its way to the board. */
interface Piece {
  at: P;
  size: number;
  /** When his hands let it go (performance seconds), or null while it is held. */
  left: number | null;
  /** Where it flies from and to (its board place's centre), set as the flight starts. */
  from?: P;
  to?: P;
  node: BoardNode;
  done: boolean;
}

interface State {
  run: number;
  index: number;
  /** Activate: the two rings under his palms, and the spread's widest and narrowest gaps. */
  rings: Piece[];
  wide: { min: number; gap: number; peaked: boolean };
  /** Explain: the idea between his palms. */
  orb: Piece | null;
  /** Demonstrate: each step, set down where its chop lands; the step the raised hand is for; stillness count. */
  steps: Piece[];
  armed: number;
  still: number;
  last: P | null;
  /** Challenge: the card on his palms, and its width. */
  card: (Piece & { w: number }) | null;
  /** Connect: what comes next in his hand, and the widest gap while his hands close. */
  next: Piece | null;
  joinMax: number;
  /** The board places lit so far. */
  lit: Set<BoardNode>;
}

const fresh = (run: number): State => ({
  run, index: -1, rings: [], wide: { min: Infinity, gap: 0, peaked: false }, orb: null, steps: [], armed: -1, still: 0,
  last: null, card: null, next: null, joinMax: 0, lit: new Set(),
});

/**
 * What Jake makes in his hands at each of the five moves (V8.3b), and its flight onto the board (MovesBoard), so the
 * section tells one story: the volcano lesson built up move by move. Each piece is placed every frame from his palms
 * as the stage reports them (shared.hands, read from his bones in the frame it renders), so each gesture lands on a
 * real thing at his scale:
 * - Activate (Imagine, palms down, spreading): what you already know, a ring of light under each palm;
 * - Explain (HoldIdea): the idea, an orb of light between his palms;
 * - Demonstrate (StepBeat, three chops): each chop sets a step down under his hand;
 * - Challenge (YourTurn, palms up, offered): the question card, paper, resting on his palms;
 * - Connect (BringTogether): what you have just learned in one hand and what comes next in the other, linked as his
 *   hands close.
 * Once his hands let a piece go it rests a moment, then flies to its place on the board, which lights. In Challenge
 * the answer arrives on the board and is marked right. Only on the live path.
 */
export function MovesHands({ wrap, board }: { wrap: RefObject<HTMLDivElement | null>; board: RefObject<HTMLDivElement | null> }) {
  const rings = useRef<(HTMLSpanElement | null)[]>([]);
  const orb = useRef<HTMLSpanElement>(null);
  const steps = useRef<(HTMLSpanElement | null)[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const join = useRef<(HTMLSpanElement | null)[]>([]);
  const joinLink = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let st = fresh(-1);
    const nodeEl = (id: BoardNode) => board.current?.querySelector<HTMLElement>(`[data-node="${id}"]`) ?? null;
    const setOn = (el: Element | null | undefined, on: boolean, attr = "data-on") => {
      if (!el) return;
      if (on && !el.hasAttribute(attr)) el.setAttribute(attr, "");
      if (!on && el.hasAttribute(attr)) el.removeAttribute(attr);
    };
    /** Lights a board place, and every link whose two ends are now lit. */
    const light = (id: BoardNode) => {
      if (st.lit.has(id)) return;
      st.lit.add(id);
      setOn(nodeEl(id), true);
      board.current?.querySelectorAll<HTMLElement>("[data-group]").forEach((g) => { if (g.dataset.group!.split(" ").includes(id)) setOn(g, true); });
      for (const [a, b] of BOARD_LINKS) if (st.lit.has(a) && st.lit.has(b)) setOn(board.current?.querySelector(`[data-link="${a}-${b}"]`), true);
    };
    const clearBoard = () => {
      board.current?.querySelectorAll("[data-node], [data-link], [data-group]").forEach((el) => { setOn(el, false); setOn(el, false, "data-answer"); setOn(el, false, "data-tick"); });
    };
    /** A board place's orb centre in the section's box. */
    const target = (id: BoardNode, box: DOMRect): P => {
      const o = nodeEl(id)?.querySelector("[data-orb]")?.getBoundingClientRect();
      if (!o) return { x: 0, y: 0 };
      return { x: o.left + o.width / 2 - box.left, y: o.top + o.height / 2 - box.top };
    };

    // Sizes are always given (never read back from the page), so a frame writes styles and reads one box.
    const put = (el: HTMLElement | null | undefined, p: P | null, o: number, w: number, h: number, size = false, scale = 1) => {
      if (!el) return;
      if (!p || o <= 0.01) { if (el.style.opacity !== "0") el.style.opacity = "0"; return; }
      if (size) { el.style.width = `${w}px`; el.style.height = `${h}px`; }
      el.style.opacity = String(o);
      el.style.transform = `translate3d(${p.x - w / 2}px, ${p.y - h / 2}px, 0)${scale !== 1 ? ` scale(${scale})` : ""}`;
    };
    const hide = (...els: (HTMLElement | null | undefined)[]) => els.forEach((el) => { if (el && el.style.opacity !== "0") el.style.opacity = "0"; });
    const hideAll = () => hide(...rings.current, orb.current, ...steps.current, card.current, ...join.current, joinLink.current);

    /**
     * A piece once his hands have let it go: it rests REST_S where it was, flies to its board place in FLY_S (on a
     * gentle arc, shrinking to the place's size), and lights the place as it arrives. Returns where it is, its size
     * and how far along it is, or null once it has landed.
     */
    const fly = (pc: Piece, now: number, box: DOMRect, endSize: number): { p: P; size: number; k: number } | null => {
      if (pc.done) return null;
      const k = pc.left === null ? 0 : clamp01((now - pc.left - REST_S) / FLY_S);
      if (k > 0 && !pc.to) { pc.from = pc.at; pc.to = target(pc.node, box); }
      if (k >= 1) { pc.done = true; light(pc.node); return null; }
      if (!pc.to || !pc.from) return { p: pc.at, size: pc.size, k: 0 };
      const e = ease(k);
      const lift = Math.sin(Math.PI * e) * 40;
      return { p: { x: lerp(pc.from.x, pc.to.x, e), y: lerp(pc.from.y, pc.to.y, e) - lift }, size: lerp(pc.size, endSize, e), k: e };
    };

    const frame = () => {
      const box = wrap.current?.getBoundingClientRect();
      const c = clockOf("moves");
      const beat = moveBeatAt(c.t);
      const hands = shared.hands;
      if (!box || hands.spot !== "moves" || !hands.palms) { hideAll(); return; }
      const index = beat?.index ?? -1;
      if (c.run !== st.run || index < st.index) { st = fresh(c.run); hideAll(); clearBoard(); }
      const now = performance.now() / 1000;
      if (index !== st.index) {
        // A move that never got its gesture (its clips not loaded yet, or the reader came back mid-move) still fills
        // its board places as the next one starts, so the board always tells the whole story so far.
        for (let i = 0; i < index; i++) FILLS[i].forEach(light);
        st.index = index;
      }
      if (c.t >= MOVES_T.length) FILLS.flat().forEach(light);
      setOn(nodeEl("q"), c.t >= MOVES_T.answer, "data-answer");
      setOn(nodeEl("q"), c.t >= MOVES_T.nod, "data-tick");
      if (!beat) return;

      // His palms in the section's own box (his right hand is on screen left, his left on screen right), and each
      // hand's lowest point (a fingertip, the thumb), for what sits under it.
      const L: P = { x: hands.palms.l.x - box.left, y: hands.palms.l.y - box.top };
      const R: P = { x: hands.palms.r.x - box.left, y: hands.palms.r.y - box.top };
      const lowL: P = hands.low ? { x: hands.low.l.x - box.left, y: hands.low.l.y - box.top } : L;
      const lowR: P = hands.low ? { x: hands.low.r.x - box.left, y: hands.low.r.y - box.top } : R;
      const both = hands.lift.l > UP && hands.lift.r > UP;
      const gap = dist(L, R), m = mid(L, R);

      // Activate: a ring under each palm while his hands spread out, palms down; where the spread peaks they are let go.
      if (beat.move === "activate" || st.rings.length) {
        const out = hands.lift.l > HELD && hands.lift.r > HELD;
        if (beat.move === "activate" && !st.wide.peaked && out) {
          const under = [{ x: R.x, y: lowR.y + CLEAR + RING / 2 }, { x: L.x, y: lowL.y + CLEAR + RING / 2 }];
          if (!st.rings.length) st.rings = (["k0", "k1"] as const).map((node, i) => ({ at: under[i], size: RING, left: null, node, done: false }));
          st.rings.forEach((r, i) => { r.at = under[i]; });
          // (His hands come in a little before they spread: the peak counts only after a real spread.)
          st.wide.min = Math.min(st.wide.min, gap);
          if (gap > st.wide.gap) st.wide.gap = gap;
          else if (st.wide.gap > st.wide.min + 80 && gap < st.wide.gap - 6) st.wide.peaked = true;
        }
        if (st.rings.length && !st.wide.peaked && !out) st.wide.peaked = true;
        st.rings.forEach((r, i) => {
          if (st.wide.peaked && r.left === null) r.left = now;
          const f = fly(r, now, box, RING);
          put(rings.current[i], f?.p ?? null, 1, RING, RING, true);
        });
      }

      // Explain: the idea between his palms while they hold it.
      if (beat.move === "explain" || st.orb) {
        if (beat.move === "explain" && !st.orb && hands.lift.l > HELD && hands.lift.r > HELD) st.orb = { at: m, size: gap * ORB_OF_GAP, left: null, node: "idea", done: false };
        const o = st.orb;
        if (o) {
          if (o.left === null) {
            if (hands.lift.l > LET_GO && hands.lift.r > LET_GO) { o.at = m; o.size = gap * ORB_OF_GAP; } else o.left = now;
          }
          const f = fly(o, now, box, DOT);
          put(orb.current, f?.p ?? null, 1, f?.size ?? 0, f?.size ?? 0, true);
        }
      }

      // Demonstrate: each step, his right hand rises above his shoulder line, then the chop stops and holds: there,
      // under the hand's edge, the step is set down.
      if (beat.move === "demonstrate") {
        if (beat.step >= st.steps.length && hands.lift.r > -0.1) st.armed = beat.step;
        const speed = st.last ? dist(R, st.last) : 99;
        st.last = R;
        st.still = speed < 1.2 ? st.still + 1 : 0;
        if (st.armed === beat.step && st.steps.length === beat.step && hands.lift.r > UP && hands.lift.r < 0 && st.still >= 2) {
          st.steps.push({ at: { x: lowR.x, y: lowR.y + CLEAR + STEP / 2 }, size: STEP, left: now, node: `s${beat.step}` as BoardNode, done: false });
          st.armed = -1;
        }
      }
      st.steps.forEach((s, j) => {
        const f = fly(s, now, box, STEP);
        put(steps.current[j], f?.p ?? null, 1, STEP, STEP);
      });

      // Challenge: the card rests on his offered palms, its bottom corners on them; when his hands go down it is let
      // go, and flies to the board, where it becomes the question.
      if (beat.move === "challenge" || st.card) {
        if (beat.move === "challenge" && both && (!st.card || st.card.left === null)) {
          const w = Math.max(160, Math.min(240, gap + 24));
          st.card = { at: { x: m.x, y: m.y - 2 - CARD_H / 2 }, size: w, w, left: null, node: "q", done: false };
        } else if (st.card && st.card.left === null && !both) st.card.left = now;
        if (st.card) {
          const f = fly(st.card, now, box, DOT);
          if (!f) hide(card.current);
          // It shrinks onto the question's place, and fades as it arrives there.
          else put(card.current, f.p, 1 - clamp01((f.k - 0.6) / 0.4), st.card.w, CARD_H, true, f.size / st.card.w);
        }
      }

      // Connect: what you have just learned (the answer, lit) in his right hand (screen left), what comes next in his
      // left; the link closes with his hands; when they come down, what comes next flies to its place on the board,
      // under the answer it follows from.
      if (beat.move === "connect" || st.next) {
        const held = beat.move === "connect" && both && (!st.next || st.next.left === null);
        if (held) {
          st.joinMax = Math.max(st.joinMax, gap);
          const ux = (L.x - R.x) / (gap || 1), uy = (L.y - R.y) / (gap || 1);
          const a: P = { x: R.x + ux * (DOT / 2 + 6), y: R.y + uy * (DOT / 2 + 6) };
          const b: P = { x: L.x - ux * (RING / 2 + 6), y: L.y - uy * (RING / 2 + 6) };
          st.next ??= { at: b, size: RING, left: null, node: "next", done: false };
          st.next.at = b;
          const k = st.joinMax > 0 ? clamp01((st.joinMax - gap) / (st.joinMax * 0.5)) : 0;
          put(join.current[0], a, 1, DOT, DOT);
          const ea: P = { x: a.x + ux * (DOT / 2), y: a.y + uy * (DOT / 2) }, eb: P = { x: b.x - ux * (RING / 2), y: b.y - uy * (RING / 2) };
          const el = joinLink.current;
          if (el) {
            el.style.opacity = k > 0.01 ? "1" : "0";
            el.style.width = `${dist(ea, eb)}px`;
            el.style.transform = `translate3d(${ea.x}px, ${ea.y - 1}px, 0) rotate(${Math.atan2(eb.y - ea.y, eb.x - ea.x)}rad) scaleX(${k})`;
          }
        } else if (st.next && st.next.left === null && st.joinMax > 0) {
          st.next.left = now;
          hide(join.current[0], joinLink.current);
        }
        if (st.next) {
          const f = fly(st.next, now, box, RING);
          put(join.current[1], f?.p ?? null, 1, RING, RING, true);
        }
      }
    };

    // The stage calls this each frame it renders him here, after reading his bones (shared.hands.onReport).
    shared.hands.onReport = frame;
    const off = subscribe(() => { if (host.live !== "moves" || !host.onScreen) hideAll(); });
    return () => { off(); if (shared.hands.onReport === frame) shared.hands.onReport = null; };
  }, [wrap, board]);

  const base = "pointer-events-none absolute left-0 top-0 z-20";
  return (
    <div aria-hidden>
      {[0, 1].map((i) => (
        <span key={`r${i}`} ref={(el) => { rings.current[i] = el; }} data-track={`ring${i}`} className={`${base} landing-move-ring`} style={{ opacity: 0 }} />
      ))}
      <span ref={orb} data-track="orb" className={`${base} landing-orb rounded-full`} style={{ opacity: 0 }} />
      {[0, 1, 2].map((i) => (
        <span key={`s${i}`} ref={(el) => { steps.current[i] = el; }} data-track={`step${i}`} className={`${base} landing-move-dot`} style={{ width: STEP, height: STEP, opacity: 0 }} />
      ))}
      <div ref={card} data-track="card" className={`${base} theme-paper landing-move-card overflow-hidden rounded-2xl border border-line bg-surface px-4 py-3 text-ink`} style={{ height: CARD_H, opacity: 0, transformOrigin: "50% 50%" }}>
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-accent-text">Your turn</span>
        <span className="mt-1 block text-[13px] font-semibold leading-snug text-ink">{BOARD_NODES.q.label}</span>
        <span className="mt-2 flex items-center gap-1 rounded-[8px] border border-line px-2 py-1 text-[12px] text-muted">
          <span className="landing-caret" />
          Your answer
        </span>
      </div>
      <span ref={joinLink} className={`${base} landing-move-link origin-left`} style={{ opacity: 0 }} />
      <span ref={(el) => { join.current[0] = el; }} data-track="idea" className={`${base} landing-move-dot`} style={{ width: DOT, height: DOT, opacity: 0 }} />
      <span ref={(el) => { join.current[1] = el; }} data-track="next" className={`${base} landing-move-ring`} style={{ opacity: 0 }} />
    </div>
  );
}
