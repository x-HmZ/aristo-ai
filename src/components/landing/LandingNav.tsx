import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { Wordmark } from "@/components/landing/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NAV_LINKS } from "./content";
import { BTN_GHOST, BTN_PRIMARY, WRAP } from "./ui";
import { demoHref, getServerTeacher, getTeacher, subscribeTeacher } from "./teacher";

/**
 * The section in view: the last linked section whose top has passed a line 45% down the viewport, and whose bottom
 * has not. Read on scroll (passive, once per frame at most), so a jump by the keyboard or a link is caught too.
 */
function useCurrentSection(ids: readonly string[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const line = window.innerHeight * 0.45;
      let found: string | null = null;
      for (const id of ids) {
        const r = document.getElementById(id)?.getBoundingClientRect();
        if (r && r.top <= line && r.bottom > line) found = id;
      }
      setCurrent((c) => (c === found ? c : found));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);
  return current;
}

const LINK = cn(SHAPE.pill, FOCUS, "inline-flex min-h-[44px] items-center px-3.5 text-sm font-medium text-body transition-colors hover:bg-sunk hover:text-ink aria-[current=true]:bg-sunk aria-[current=true]:text-ink");
const IDS = NAV_LINKS.map((l) => l.id);

/**
 * The floating pill nav (V8.3b, mockup E): the mark, the section links with the one in view sunk, the theme toggle,
 * Sign in and Try a lesson, 60px tall and every target 44px. Below lg the links, the toggle and Sign in move into a
 * sheet under the pill, behind a menu button.
 */
export function LandingNav() {
  const teacher = useSyncExternalStore(subscribeTeacher, getTeacher, getServerTeacher);
  const current = useCurrentSection(IDS);
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  // Escape closes the sheet and returns focus to the button; so does a click outside the nav or widening past lg.
  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    const onDown = (e: PointerEvent) => {
      const nav = button.current?.closest("[data-nav]");
      if (nav && !nav.contains(e.target as Node)) setOpen(false);
    };
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => { if (wide.matches) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    wide.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40">
      <div className={WRAP} data-nav>
        <nav
          aria-label="Main"
          className={cn(
            SHAPE.pill,
            "pointer-events-auto flex h-[60px] items-center gap-1 border border-line bg-surface/[0.88] pl-4 pr-2 shadow-e1 backdrop-blur-md backdrop-saturate-150 sm:gap-2 sm:pl-5"
          )}
        >
          <Link href="/" aria-label="Aristo home" className={cn("inline-flex min-h-[44px] items-center rounded-sm", FOCUS)}>
            <Wordmark />
          </Link>

          <div className="mx-auto hidden gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.id} href={`#${l.id}`} aria-current={current === l.id ? "true" : undefined} className={LINK}>
                {l.label}
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link href="/sign-in" className={cn(BTN_GHOST, "hidden text-sm lg:inline-flex")}>
              Sign in
            </Link>
            <Link href={demoHref(teacher)} className={cn(BTN_PRIMARY, SHAPE.pill, "px-3.5 text-sm sm:px-[18px]")}>
              Try a lesson
            </Link>
            <button
              ref={button}
              type="button"
              aria-expanded={open}
              aria-controls={sheetId}
              aria-label={open ? "Close the menu" : "Open the menu"}
              onClick={() => setOpen((o) => !o)}
              className={cn(SHAPE.control, PRESS, FOCUS, "inline-grid size-11 place-items-center text-body hover:bg-sunk hover:text-ink lg:hidden")}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>

        {/* The sheet: always in the DOM below lg (hidden while closed), so the button's aria-controls resolves. */}
        <div
          ref={sheet}
          id={sheetId}
          hidden={!open}
          className={cn(SHAPE.surface, "landing-sheet pointer-events-auto mt-2 border border-line bg-surface p-2 shadow-e2 lg:hidden")}
        >
          <ul className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  aria-current={current === l.id ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(LINK, SHAPE.control, "flex w-full px-4 text-base")}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line px-2 pt-2">
            <Link href="/sign-in" className={cn(BTN_GHOST, "px-2")}>
              Sign in
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
