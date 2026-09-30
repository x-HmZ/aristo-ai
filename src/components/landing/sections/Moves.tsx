import { useRef } from "react";
import { cn } from "@/lib/utils";
import { SHAPE } from "@/lib/design/shape";
import { CHALLENGE_QUESTION, MOVES, MOVES_COPY } from "../content";
import { Pinned, show, useStageWriter } from "../Pinned";
import { easeOut, moveAt, seg, window01 } from "../stage/timeline";
import { CaptionBand, StepRail } from "./parts";

const GLASS = "theme-ink border border-line bg-bg/[0.86] text-ink backdrop-blur-md";

/**
 * One Lesson, Five Moves (pinned, one move per fifth). The teacher delivers the heart lesson: each move shows what
 * it does, its real line in the caption band, and the teacher plays the product's own gesture for it (timeline.ts).
 * The challenge puts its question on the desk: in 3D on the live stage (DeskCard), as a card here otherwise.
 */
export function Moves() {
  const head = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const does = useRef<(HTMLParagraphElement | null)[]>([]);
  const bands = useRef<(HTMLDivElement | null)[]>([]);
  const stills = useRef<(HTMLDivElement | null)[]>([]);
  const desk = useRef<HTMLDivElement>(null);
  const last = useRef(-1);

  useStageWriter((f) => {
    const p = f.progress[3];
    show(head.current, window01(p, 0.005, 0.995, 0.005));
    const S = 3 + p;
    const move = moveAt(Math.min(S, 3.9999));
    const k = move ? move.index : -1;
    if (k !== last.current && rail.current) {
      last.current = k;
      rail.current.querySelectorAll("li").forEach((li, i) => { li.dataset.state = i < k ? "done" : i === k ? "now" : "next"; });
    }
    MOVES.forEach((_, i) => {
      const a = i / 5, b = (i + 1) / 5;
      const inWin = window01(p, a + 0.01, b - 0.01, 0.012);
      show(does.current[i], inWin, 8 * (1 - easeOut(seg(p, a, a + 0.03))));
      // The challenge's band steps aside while the question is on the desk.
      const deskOut = i === 3 ? 1 - window01(p, 0.705, 0.77, 0.02) : 1;
      show(bands.current[i], inWin * deskOut, 14 * (1 - easeOut(seg(p, a, a + 0.03))));
      show(stills.current[i], window01(p, a, b, 0.012));
    });
    // Lite path: the desk card in the DOM (the live stage draws its own in the room).
    show(desk.current, window01(p, 0.7, 0.77, 0.02));
  });

  return (
    <Pinned id="moves" labelledBy="moves-title">
      {MOVES.map((m, i) => (
        <div key={m.phase} ref={(el) => { stills.current[i] = el; }} className="landing-still landing-beat absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/images/landing/v3/move-${i + 1}.webp`} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
      ))}

      <div className="relative mx-auto h-full w-full max-w-6xl px-5 pt-[92px] sm:px-8">
        <div ref={head} className="landing-beat relative z-10 flex flex-col items-start gap-3">
          <h2 id="moves-title" className={cn(SHAPE.control, GLASS, "px-3 py-1.5 text-[24px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[30px]")}>
            {MOVES_COPY.title}
          </h2>
          <StepRail ref={rail} steps={MOVES.map((m) => m.name)} />
          <div className="landing-overlap">
            {MOVES.map((m, i) => {
              const Icon = m.icon;
              return (
                <p key={m.phase} ref={(el) => { does.current[i] = el; }} className="landing-beat">
                  <span className={cn(SHAPE.control, GLASS, "inline-flex items-center gap-2 px-3 py-2 text-base font-semibold")}>
                    <Icon className="size-4 text-accent-text" aria-hidden />
                    <span className="text-accent-text">{i + 1}. {m.name}</span>
                    <span className="text-ink">{m.does}</span>
                  </span>
                </p>
              );
            })}
          </div>
        </div>

        <div className="landing-overlap">
          {MOVES.map((m, i) => (
            <CaptionBand
              key={m.phase}
              ref={(el) => { bands.current[i] = el; }}
              line={m.line}
              segment={m.segment}
              label={`${m.name}, step ${i + 1} of 5`}
            />
          ))}
        </div>

        <div ref={desk} className="landing-still landing-beat absolute inset-x-5 bottom-[16svh] z-10 mx-auto max-w-[520px] sm:inset-x-8">
          <div className={cn(SHAPE.surface, "theme-paper border border-line bg-surface px-5 py-5 text-ink shadow-e2")}>
            <p className="text-xs font-semibold text-accent-text">Challenge, on your desk</p>
            <p className="mt-2 text-lg font-semibold leading-snug">{CHALLENGE_QUESTION}</p>
            <p className="mt-3 text-sm text-body">Answer out loud, or type it.</p>
          </div>
        </div>
      </div>
    </Pinned>
  );
}
