import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Box, Pause, Play, Presentation, RotateCcw, Target, UserRound, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { ROOM_COPY } from "../content";
import { clockOf, restart, seek, setPaused, subscribeClock, useCue, useSectionPlay } from "../play";
import type { LandingMode } from "../stage/gate";
import { host, nearRoom, registerSpot } from "../stage/host";
import { LOOK_PITCH, LOOK_YAW, ROOM_ASPECT, ROOM_T, lineAt } from "../stage/room";
import { shared } from "../stage/shared";
import { isSoundOn, lineData, loadLine, setSound, speak, subscribe as subscribeSound, syncAudio, wordsSpoken } from "../stage/sound";
import { H2, LEDE, REAL, WRAP } from "../ui";

const SHOT_ICONS = [UserRound, Presentation, Box, Target] as const;
/** Radians of look per CSS pixel dragged. */
const LOOK_RATE = 0.004;
/** The tour's cues: each shot's start, then its end. */
const CUES = [...ROOM_T.shots, ROOM_T.length] as const;

const CONTROL = cn(SHAPE.control, PRESS, FOCUS, "inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap px-3.5 text-sm font-semibold");

/**
 * His line, as the tour speaks it: the words light at the recording's pace (sound.ts), his mouth follows the same
 * timings while he is live in the room, and Hear it plays the recording along (it then leads the clock). Only the
 * words whose state changed are touched, one per change.
 */
function Caption({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [sound, setSoundState] = useState(false);
  const words = useRef<(HTMLSpanElement | null)[]>([]);
  const shown = useRef({ index: 0, lit: -2 });

  useEffect(() => subscribeSound(() => setSoundState(isSoundOn())), []);
  useEffect(() => {
    for (const l of ROOM_T.lines) void loadLine(l.segment);
    const paint = (lit: number) => {
      const total = ROOM_COPY.lines[shown.current.index].split(" ").length;
      for (let k = 0; k < total; k++) {
        const s = k < lit - 1 ? "on" : k === lit - 1 ? "now" : "";
        const el = words.current[k];
        if (el && el.dataset.s !== s) el.dataset.s = s;
      }
      shown.current.lit = lit;
    };
    const tick = () => {
      const c = clockOf("room");
      const now = lineAt(c.t);
      // Between lines the last one said stays, whole; before the first, the first waits unlit.
      let index = now?.index ?? -1;
      if (index < 0) for (let i = ROOM_T.lines.length - 1; i >= 0; i--) if (c.t >= ROOM_T.lines[i].at) { index = i; break; }
      if (index >= 0 && index !== shown.current.index) {
        shown.current = { index, lit: -2 };
        setIndex(index);
        return; // the new line's words render first; the next tick lights them
      }
      if (!now || !c.playing) {
        speak(null);
        syncAudio(null, 0, false);
        const lit = index < 0 ? 0 : ROOM_COPY.lines[index].split(" ").length + 1;
        if (lit !== shown.current.lit) paint(lit);
        return;
      }
      const line = ROOM_T.lines[now.index];
      const heard = syncAudio(line.segment, now.t, true);
      let t = now.t;
      // With the sound on, the recording leads: the clock follows it.
      if (heard !== null && Math.abs(heard - t) > 0.05) { c.t = line.at + heard; t = heard; }
      speak(host.live === "room" ? line.segment : null, t);
      const d = lineData(line.segment);
      const lit = d ? Math.min(ROOM_COPY.lines[now.index].split(" ").length, wordsSpoken(d.words, t)) : 0;
      if (lit !== shown.current.lit) paint(lit);
    };
    tick();
    return subscribeClock("room", tick);
  }, []);
  useEffect(() => () => { speak(null); syncAudio(null, 0, false); }, []);

  return (
    <div className={cn(SHAPE.surface, "border border-line bg-surface px-4 pb-4 pt-3 shadow-e2", className)}>
      <div className="mb-1 flex items-center gap-2.5">
        <span className="text-sm font-semibold text-ink">Jake</span>
        <span className="text-[13px] font-semibold text-accent-text">{ROOM_COPY.shots[index]}</span>
        <button
          type="button"
          aria-pressed={sound}
          onClick={() => setSound(!sound)}
          className={cn(CONTROL, "-my-1.5 -mr-2 ml-auto px-3 text-body hover:bg-sunk hover:text-ink")}
        >
          {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
          Hear it
        </button>
      </div>
      <p key={index} className="text-[15px] font-medium leading-normal">
        {ROOM_COPY.lines[index].split(" ").map((w, k) => (
          <span key={k}>
            <span ref={(el) => { words.current[k] = el; }} className="landing-word">{w}</span>{" "}
          </span>
        ))}
      </p>
    </div>
  );
}

/** The four shots as one row of controls: a tab jumps the tour there; Pause holds it; at its end, Replay. */
function Tour({ className }: { className?: string }) {
  const { cue, playing, paused } = useCue("room", CUES);
  const shot = Math.max(0, Math.min(ROOM_T.shots.length - 1, cue));
  const done = cue >= ROOM_T.shots.length && !playing && !paused;
  return (
    <div role="group" aria-label="The tour" className={cn(SHAPE.surface, "flex flex-wrap items-center gap-1 border border-line bg-surface p-1.5 shadow-e2", className)}>
      {ROOM_COPY.shots.map((label, i) => {
        const Icon = SHOT_ICONS[i];
        const on = i === shot && !done;
        return (
          <button
            key={label}
            type="button"
            aria-current={on ? "step" : undefined}
            onClick={() => seek("room", ROOM_T.shots[i])}
            className={cn(CONTROL, on ? "bg-sunk text-ink" : "text-body hover:bg-sunk hover:text-ink")}
          >
            <Icon className={cn("size-4", on && "text-accent-text")} aria-hidden />
            {label}
          </button>
        );
      })}
      <span aria-hidden className="mx-1 h-6 w-px bg-line" />
      {done ? (
        <button type="button" onClick={() => restart("room")} className={cn(CONTROL, "text-body hover:bg-sunk hover:text-ink")}>
          <RotateCcw className="size-4" aria-hidden />
          Replay
        </button>
      ) : (
        <button
          type="button"
          aria-label={paused ? "Play the tour" : "Pause the tour"}
          onClick={() => setPaused("room", !paused)}
          className={cn(CONTROL, "w-11 justify-center px-0 text-body hover:bg-sunk hover:text-ink")}
        >
          {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
        </button>
      )}
    </div>
  );
}

/**
 * Step Into the Classroom (V8.3b, "Immersive"): the culmination. The product's own classroom, edge to edge, where
 * Jake teaches the volcano lesson while the camera tours the room: him, the board, the model, your desk (room.ts).
 * The reader can drag to look around, jump to a shot, pause, and hear him. The room loads only once the reader is
 * near (the stage imports it then); until it is live the box shows the tour's first frame. On the lite path and under
 * reduced motion the box is a still of the tour's end, with no controls.
 */
export function Immersive({ mode }: { mode: LandingMode | null }) {
  const section = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const live = mode === "full";
  useSectionPlay("room", box, ROOM_T.length, { mode, spot: "room" });

  useEffect(() => (box.current ? registerSpot("room", box.current) : undefined), []);
  // The room loads once the reader is within about two screens of the section.
  useEffect(() => {
    if (!live || !section.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { nearRoom(); io.disconnect(); } }, { rootMargin: "200% 0px 200% 0px" });
    io.observe(section.current);
    return () => io.disconnect();
  }, [live]);

  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    shared.room.dragging = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const r = shared.room;
    // Dragging the room turns the view the other way, as a head turns: drag left to look right.
    r.yaw = Math.max(-LOOK_YAW, Math.min(LOOK_YAW, r.yaw - (e.clientX - d.x) * LOOK_RATE));
    r.pitch = Math.max(-LOOK_PITCH, Math.min(LOOK_PITCH, r.pitch + (e.clientY - d.y) * LOOK_RATE));
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onUp = () => { drag.current = null; shared.room.dragging = false; };

  return (
    <section ref={section} id="immersive" aria-labelledby="room-title" className="overflow-x-clip pt-24">
      <div className={WRAP}>
        <h2 id="room-title" className={H2}>{ROOM_COPY.title}</h2>
        <p className={cn(LEDE, "mt-4")}>{live ? ROOM_COPY.line : ROOM_COPY.lineStill}</p>
      </div>
      {/* The room and, from lg, its controls over its bottom corners; below lg the controls follow it. */}
      <div className="relative mt-8">
      <div
        ref={box}
        data-spot="room"
        className="landing-spot landing-room relative w-full overflow-hidden bg-sunk max-sm:![aspect-ratio:4/3]"
        style={{ aspectRatio: String(ROOM_ASPECT), maxHeight: "88svh" }}
      >
        {/* The tour's end (lite, the stack, no JS) and, on the live path, its first frame: placed as the camera frames a box of
            any aspect (room.ts roomFov), centred and covering. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a covering still; next/image adds nothing here */}
        <img src="/images/landing/v3b/room.webp" alt="Jake in the classroom beside the volcano model, the lesson's picture on the board" className="landing-spot-still landing-still-end absolute inset-0 h-full w-full object-cover" decoding="async" loading="lazy" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/landing/v3b/room-start.webp" alt="" aria-hidden className="landing-spot-still landing-still-start absolute inset-0 h-full w-full object-cover" decoding="async" loading="lazy" />
        {live && (
          <>
            <div
              aria-hidden
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="absolute inset-0 z-20 cursor-grab touch-pan-y select-none active:cursor-grabbing"
            />
          </>
        )}
      </div>
      {live && (
        <div className={cn(WRAP, "mt-4 flex flex-col gap-3 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:bottom-6 lg:mt-0 lg:max-w-none lg:flex-row lg:items-end lg:justify-between lg:px-6")}>
          <Tour className="relative z-20 self-start lg:pointer-events-auto lg:self-end" />
          <Caption className="relative z-20 lg:pointer-events-auto lg:w-[min(400px,36%)]" />
        </div>
      )}
      </div>
      <div className={cn(WRAP, "pb-24")}>
        <p className={cn(REAL, "mt-4")}>{ROOM_COPY.real}</p>
      </div>
    </section>
  );
}
