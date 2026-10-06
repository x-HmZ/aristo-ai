"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  isTheme,
  type Theme,
} from "@/components/theme/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function resolvedTheme(): Theme {
  const chosen = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  return isTheme(chosen) ? chosen : systemTheme();
}

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStored(value: Theme | null) {
  try {
    if (value) localStorage.setItem(THEME_STORAGE_KEY, value);
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Storage can throw in private modes. The choice still applies for this
    // page view through the attribute; it just is not remembered.
  }
}

/**
 * Light/dark switch. It renders on the landing page (nav and footer) and in
 * the classroom top bar (/learn, /demo); the choice applies app-wide (every
 * page follows the theme since V8.6).
 *
 * Which icon shows is decided by CSS (`--theme-icon-sun` / `--theme-icon-moon`,
 * swapped with the rest of the theme tokens), not by state, so the server
 * render already shows the right one and nothing flips on hydration.
 *
 * There is deliberately no third "system" option to explain. Choosing the
 * mode the OS already asks for clears the stored choice, which hands control
 * back to prefers-color-scheme.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

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
    const next: Theme = resolvedTheme() === "dark" ? "light" : "dark";
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
        "inline-flex size-11 items-center justify-center border border-line text-muted hover:border-muted/50 hover:text-ink",
        className
      )}
    >
      <Sun aria-hidden className="size-[18px] [display:var(--theme-icon-sun)]" />
      <Moon aria-hidden className="size-[18px] [display:var(--theme-icon-moon)]" />
    </button>
  );
}
