"use client";

/**
 * Modal behaviour for the classroom's in-place dialogs (V8.6): the mode picker,
 * the course map and the dashboard. They render inside the /learn shell rather
 * than a Radix portal, so this gives them what a portal dialog would:
 *
 * - `role="dialog"` and `aria-modal` (spread the returned props on the panel,
 *   which also carries `aria-labelledby`);
 * - focus moves to the panel on open and back to where it was on close;
 * - Tab and Shift+Tab stay inside the panel;
 * - Escape calls `onClose` (omit it for a dialog that must be answered).
 *
 * Only the topmost open dialog handles keys, so stacked dialogs do not fight.
 */

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: HTMLElement[] = [];

export function useModalDialog<T extends HTMLElement>(onClose?: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stack.push(panel);
    panel.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== panel) return;
      if (e.key === "Escape" && closeRef.current) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      const i = stack.lastIndexOf(panel);
      if (i >= 0) stack.splice(i, 1);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return { ref, role: "dialog" as const, "aria-modal": true as const, tabIndex: -1 };
}
