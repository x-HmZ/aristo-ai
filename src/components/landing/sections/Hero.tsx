import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Hand, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { HERO } from "../content";
import { Spot } from "../Spot";
import type { LandingMode } from "../stage/gate";
import { greetHero, host } from "../stage/host";
import { shared } from "../stage/shared";
import { BTN_LG, BTN_OUTLINE, BTN_PRIMARY, LEDE, WRAP } from "../ui";
import {
  LANDING_TEACHERS, TEACHER_NAME, demoHref, getServerTeacher, getTeacher, leanTowards, setTeacher, subscribeTeacher, type LandingTeacher,
} from "../teacher";

/**
 * The teacher chooser (V8.3c): Jake or MJ, for the whole page and Try a lesson. Two pressed-state buttons, each with
 * the teacher's face; a pointer over one, or focus on it, gets that teacher ready on the stage before the click. The
 * pressed look comes from `html[data-teacher]` (globals.css), set before the first paint, so an MJ-first load never
 * shows Jake pressed while it hydrates; a change is announced.
 */
function TeacherChooser({ className }: { className?: string }) {
  const teacher = useSyncExternalStore(subscribeTeacher, getTeacher, getServerTeacher);
  const [said, setSaid] = useState("");
  const choose = (t: LandingTeacher) => {
    if (t === getTeacher()) return;
    setTeacher(t);
    setSaid(`${TEACHER_NAME[t]} is now your teacher.`);
  };
  return (
    <div role="group" aria-label={HERO.choose} data-chooser className={cn("flex flex-wrap items-center gap-3", className)}>
      <span className="sr-only" role="status">{said}</span>
      <span aria-hidden className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">{HERO.choose}</span>
      <div className={cn(SHAPE.pill, "inline-flex gap-1 border border-line bg-surface p-1 shadow-e1")}>
        {LANDING_TEACHERS.map((t) => {
          const on = t === teacher;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              data-t={t}
              onClick={() => choose(t)}
              onPointerEnter={() => leanTowards(t)}
              onFocus={() => leanTowards(t)}
              className={cn(
                SHAPE.pill, PRESS, FOCUS,
                "inline-flex min-h-[44px] items-center gap-2 py-1 pl-1 pr-4 text-sm font-semibold text-body transition-colors hover:bg-sunk hover:text-ink",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a 36 px face; next/image adds nothing here */}
              <img src={`/images/landing/v3b/face-${t}.webp`} alt="" width={36} height={36} className="size-9 rounded-full bg-sunk object-cover" decoding="async" />
              {TEACHER_NAME[t]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A call to action earns one reaction at most this often. */
const REACT_EVERY_MS = 3000;
/** How long he looks at the button his hand goes to: PresentModel (2.63 s) and its fade. */
const GESTURE_LOOK_MS = 3000;
/** A tap on Jake waves again at most this often. */
const TAP_EVERY_MS = 2500;
/** Coming back to the page after this long away earns a welcome-back wave, at most once per WELCOME_EVERY_MS. */
const AWAY_MS = 3000;
const WELCOME_EVERY_MS = 8000;

/**
 * The hero (V8.3b): the positioning line on the left, Jake on the right. No lesson here: he says hello.
 *
 * On the live path he waves when he appears, then plays along with the reader, always with the product's own
 * gestures so each means what it means in a lesson:
 * - his head and eyes follow the mouse pointer (LandingStage `viewer`);
 * - pointing at, or focusing, Try a lesson: his left hand offered palm up towards it (the product's PresentModel),
 *   his head and eyes on it;
 * - a tap on him: another wave; coming back to the page after a while: a welcome-back wave.
 * The text is not faded in by JS, so the H1 paints first. On the lite path he is a still and nothing reacts.
 */
export function Hero({ mode }: { mode: LandingMode | null }) {
  const live = mode === "full";
  const teacher = useSyncExternalStore(subscribeTeacher, getTeacher, getServerTeacher);
  const section = useRef<HTMLElement>(null);
  const lastReact = useRef(0);
  const lastTap = useRef(0);

  // The pointer, for where he looks; and the welcome back.
  useEffect(() => {
    if (!live) return;
    let leftAt: number | null = null;
    let lastWelcome = 0;
    const move = (e: PointerEvent) => { shared.pointer = e.pointerType === "touch" ? null : { x: e.clientX, y: e.clientY }; };
    const leave = () => { shared.pointer = null; leftAt = performance.now(); };
    const enter = () => {
      const now = performance.now();
      const r = section.current?.getBoundingClientRect();
      const inView = !!r && r.bottom > window.innerHeight * 0.3 && r.top < window.innerHeight * 0.7;
      if (leftAt !== null && now - leftAt >= AWAY_MS && now - lastWelcome >= WELCOME_EVERY_MS && inView && host.live === "hero") {
        lastWelcome = now;
        greetHero();
      }
      leftAt = null;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    document.documentElement.addEventListener("mouseenter", enter);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("mouseleave", leave);
      document.documentElement.removeEventListener("mouseenter", enter);
      shared.pointer = null;
      shared.hero.hover = null;
      shared.hero.look = null;
    };
  }, [live]);

  const hover = (which: "try" | null) => (e: { currentTarget: HTMLElement }) => {
    if (!live) return;
    if (which) {
      const now = performance.now();
      if (now - lastReact.current < REACT_EVERY_MS) return;
      lastReact.current = now;
      shared.hero.seq += 1;
      // His eyes go where his hand goes, for as long as the gesture plays.
      shared.hero.look = { el: e.currentTarget, until: now + GESTURE_LOOK_MS };
    }
    shared.hero.hover = which;
  };
  const tap = () => {
    const now = performance.now();
    if (now - lastTap.current < TAP_EVERY_MS || host.live !== "hero") return;
    lastTap.current = now;
    greetHero();
  };

  return (
    <section ref={section} id="top" aria-labelledby="hero-title" className="overflow-x-clip pb-[72px] pt-[108px] lg:pb-[88px] lg:pt-[112px]">
      <div className={cn(WRAP, "grid items-center gap-10 lg:grid-cols-2 lg:gap-14")}>
        {/* Text first on a phone. On a wide screen Jake is on the left and the text sits level with his head, so the
            buttons come to about the height of his offered hand (the offer and his gaze meet on Try a lesson). */}
        <div className="lg:order-2 lg:self-start">
          <p className="mb-[18px] text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">{HERO.eyebrow}</p>
          <h1
            id="hero-title"
            className="display-wide text-[36px] font-extrabold leading-[0.98] tracking-[-0.02em] sm:text-[56px] lg:text-[48px] xl:text-[56px]"
          >
            {HERO.lines.map((line, i) => (
              <span
                key={line}
                className={cn("landing-rise block whitespace-nowrap", i === 2 && "text-accent-text")}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {line}
              </span>
            ))}
          </h1>
          <p className={cn(LEDE, "mt-6")}>{HERO.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={demoHref(teacher)}
              onPointerEnter={hover("try")} onPointerLeave={hover(null)} onFocus={hover("try")} onBlur={hover(null)}
              className={cn(BTN_PRIMARY, BTN_LG, "max-[479px]:flex-[1_1_100%]")}
            >
              <Play className="size-4 fill-current" strokeWidth={0} />
              Try a lesson
            </Link>
            <Link
              href="/sign-up"
              className={cn(BTN_OUTLINE, BTN_LG, "max-[479px]:flex-[1_1_100%]")}
            >
              Create an account
            </Link>
          </div>
          <TeacherChooser className="mt-7" />
        </div>
        <div className="relative mx-auto w-full max-w-[600px] lg:order-1 lg:max-w-none">
          <Spot
            id="hero"
            still="/images/landing/v3b/hero.webp"
            priority
            alt="{teacher}, your teacher, waves hello"
            className="h-[470px] sm:h-[600px]"
            pool="inset-x-[8%] -bottom-[6%] h-3/5"
          >
            {live && (
              // Over his figure: a tap waves again. Invisible, with a focus ring for the keyboard.
              <button
                type="button"
                aria-label={`Say hi to ${TEACHER_NAME[teacher]}`}
                onClick={tap}
                className={cn(SHAPE.surface, FOCUS, "absolute left-[4%] top-[4%] z-20 h-[72%] w-[52%] cursor-pointer")}
              />
            )}
          </Spot>
          {live && (
            <p
              aria-hidden
              className={cn(SHAPE.pill, "absolute bottom-[4%] right-0 z-20 inline-flex items-center gap-2 border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-body shadow-e1")}
            >
              <Hand className="size-4 text-accent-text" aria-hidden />
              {HERO.hint}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
