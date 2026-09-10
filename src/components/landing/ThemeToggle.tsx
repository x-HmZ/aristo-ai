"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/components/landing/shape";
import {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  isLandingTheme,
  type LandingTheme,
} from "@/components/landing/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): LandingTheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function resolvedTheme(): LandingTheme {
  const chosen = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  return isLandingTheme(chosen) ? chosen : systemTheme();
}

function readStored(): LandingTheme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isLandingTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStored(value: LandingTheme | null) {
  try {
    if (value) localStorage.setItem(THEME_STORAGE_KEY, value);
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Storage can throw in private modes. The choice still applies for this
    // page view through the attribute; it just is not remembered.
  }
}

/**
 * Light/dark switch for the landing page.
 *
 * Which icon shows is decided by CSS (`--lp-icon-sun` / `--lp-icon-moon`,
 * swapped with the rest of the theme tokens), not by state, so the server
 * render already shows the right one and nothing flips on hydration.
 *
 * There is deliberately no third "system" option to explain. Choosing the
 * mode the OS already asks for clears the stored choice, which hands control
 * back to prefers-color-scheme.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<LandingTheme | null>(null);

  useEffect(() => {
    // The pre-paint script only runs on a full page load. After a client-side
    // navigation back to "/", re-apply the stored choice here.
    const stored = readStored();
    if (stored) document.documentElement.setAttribute(THEME_ATTRIBUTE, stored);
    setTheme(resolvedTheme());

    // Stay in step with the OS setting and with any other toggle on the page
    // (the nav and the footer each render one): both only ever change the
    // media query result or the <html> attribute, so watch those.
    const sync = () => setTheme(resolvedTheme());
    const media = window.matchMedia(DARK_QUERY);
    media.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [THEME_ATTRIBUTE],
    });
    return () => {
      media.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  const toggle = useCallback(() => {
    const next: LandingTheme = resolvedTheme() === "dark" ? "light" : "dark";
    const root = document.documentElement;
    if (next === systemTheme()) {
      root.removeAttribute(THEME_ATTRIBUTE);
      writeStored(null);
    } else {
      root.setAttribute(THEME_ATTRIBUTE, next);
      writeStored(next);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      className={cn(
        SHAPE.control,
        PRESS,
        FOCUS,
        "inline-flex size-11 items-center justify-center border border-lp-line text-lp-muted hover:border-lp-muted/50 hover:text-lp-ink",
        className
      )}
    >
      <Sun aria-hidden className="size-[18px] [display:var(--lp-icon-sun)]" />
      <Moon aria-hidden className="size-[18px] [display:var(--lp-icon-moon)]" />
    </button>
  );
}
