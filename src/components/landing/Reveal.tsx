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
 * Do NOT wrap the hero in this. Its start state is `opacity: 0`, and Chrome
 * does not credit a transparent element as painted — wrapping the LCP
 * candidate here pushes Largest Contentful Paint out by hydration time plus
 * the transition. Above-the-fold content has nothing to reveal anyway.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";

/** Matches the observer's rootMargin, so both paths reveal at the same line. */
const REVEAL_MARGIN_PX = 80;

/**
 * How often an element that is still hidden re-checks its own position.
 *
 * This is the backstop for the observer never reporting, which is not
 * hypothetical: IntersectionObserver delivered no callbacks at all in the
 * CDP-driven Chrome this page was verified in, and "hidden until something
 * fires" would have shipped a blank marketing page. A page that skips its
 * animation is far better than one that renders nothing.
 *
 * It is a repeating check rather than a one-shot timer on purpose. A one-shot
 * has to decide, once, whether the observer is healthy — and any such latch
 * either gives up too eagerly on a slow load or, if it trusts a single
 * callback, leaves everything it has already stood down permanently hidden
 * when delivery stops. Re-checking is self-healing and needs no such guess.
 * The interval clears as soon as the element is shown, so a healthy page
 * settles to zero timers.
 */
const FALLBACK_CHECK_MS = 1200;

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to stagger this element behind its siblings. */
  delay?: number;
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const { ref: observerRef, inView } = useInView({
    triggerOnce: true,
    threshold: 0.15,
    rootMargin: `0px 0px -${REVEAL_MARGIN_PX}px 0px`,
  });
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [fallbackVisible, setFallbackVisible] = useState(false);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      observerRef(node);
    },
    [observerRef]
  );

  useEffect(() => {
    if (inView || fallbackVisible) return;

    const id = setInterval(() => {
      const node = nodeRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < viewportHeight - REVEAL_MARGIN_PX && rect.bottom > 0) {
        setFallbackVisible(true);
      }
    }, FALLBACK_CHECK_MS);

    return () => clearInterval(id);
  }, [inView, fallbackVisible]);

  const visible = inView || fallbackVisible;

  return (
    <div
      ref={setRefs}
      className={cn("landing-reveal", visible && "is-visible", className)}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
