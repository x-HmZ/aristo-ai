"use client";

/**
 * The enlarged teaching picture, opened by the picture's Expand button on the display (store.previewZoomUrl).
 * One component for the classroom and the demo. Escape and a click outside close it, and focus goes back to
 * the control that opened it.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHAPE } from "@/lib/design/shape";
import { useAristoStore } from "@/store/useAristoStore";
import { cn } from "@/lib/utils";

export function ImageLightbox() {
  const url = useAristoStore((s) => s.previewZoomUrl);
  const setUrl = useAristoStore((s) => s.setPreviewZoomUrl);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!url) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setUrl(null); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [url, setUrl]);

  if (!url) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Teaching picture"
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={() => setUrl(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Teaching diagram"
        onClick={(e) => e.stopPropagation()}
        className={cn(SHAPE.surface, "max-h-[80vh] max-w-[min(90vw,700px)] object-contain shadow-e2")}
      />
      <div className="theme-ink absolute right-5 top-5">
        <Button
          ref={closeRef}
          variant="secondary"
          size="icon"
          onClick={() => setUrl(null)}
          aria-label="Close image"
          className="rounded-full"
        >
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}
