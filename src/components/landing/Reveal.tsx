"use client";

/**
 * Reveal — the landing page's only client component.
 *
 * The page itself stays a server component; sections wrap their content in
 * this leaf so the scroll-in animation costs one small client boundary
 * rather than turning whole sections into client trees.
 *
 * The animation is CSS (`.landing-reveal` in globals.css) and this component
 * only flips the class, which keeps the page off framer-motion — worth ~38 kB
 * of first-load JS on a page whose whole job is to load fast. It also means
 * `prefers-reduced-motion` is honoured by a media query rather than by JS, so
 * there is no first-paint animation to un-do.
 *
 * Two safety nets, because "hidden until something fires" is a bad start
 * state for a marketing page:
 *   - no JS at all: the `<noscript>` override in page.tsx unhides everything;
 *   - JS but no observer callbacks: the grace timer below unhides everything.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";

/**
 * If nothing on the page has been reported in view within this window, treat
 * the observer as not delivering and show the content unanimated. A landing
 * page that renders blank is far worse than one that skips its animation.
 */
const OBSERVER_GRACE_MS = 1200;

// Page-load-scoped health check, shared by every Reveal on the page.
let observerHasFired = false;
let observerGaveUp = false;
const giveUpListeners = new Set<() => void>();

function giveUpOnObserver() {
  if (observerHasFired || observerGaveUp) return;
  observerGaveUp = true;
  giveUpListeners.forEach((notify) => notify());
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to stagger this element behind its siblings. */
  delay?: number;
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.15,
    rootMargin: "0px 0px -80px 0px",
  });
  const [showUnanimated, setShowUnanimated] = useState(false);

  useEffect(() => {
    if (inView) observerHasFired = true;
  }, [inView]);

  useEffect(() => {
    if (observerGaveUp) {
      setShowUnanimated(true);
      return;
    }
    const notify = () => setShowUnanimated(true);
    giveUpListeners.add(notify);
    const timer = setTimeout(giveUpOnObserver, OBSERVER_GRACE_MS);
    return () => {
      giveUpListeners.delete(notify);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "landing-reveal",
        (inView || showUnanimated) && "is-visible",
        className
      )}
      style={delay && !showUnanimated ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
