"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { displayFont } from "./fonts";
import { LandingNav } from "./LandingNav";
import { SiteFooter } from "./SiteFooter";
import { ForParents } from "./ForParents";
import { Hero } from "./sections/Hero";
import { Close } from "./sections/Close";
import { decideMode, readEnv, type LandingMode } from "./stage/gate";

/**
 * The landing (V8.3b, direction E "Jake Presents"; `.claude/plans/V8.3b-landing-plan.md`). A website: a floating
 * nav, then one section per feature, each with Jake beside its own short motion graphic. Nothing is pinned or
 * scrubbed; anything that plays starts when its section comes into view.
 *
 * Server-rendered as the stack; on mount the gate picks the mode (gate.ts).
 */
export function LandingRoot() {
  // null until the gate has run (the server render and the first paint).
  const [mode, setMode] = useState<LandingMode | null>(null);

  useEffect(() => {
    setMode(decideMode(readEnv()));
  }, []);

  return (
    <div
      data-mode={mode ?? undefined}
      className={cn(displayFont.variable, "landing relative min-h-screen overflow-x-clip bg-bg font-sans text-ink antialiased")}
    >
      <header>
        <LandingNav />
      </header>

      <main>
        <Hero />
        <ForParents />
        <Close />
      </main>

      <SiteFooter />
    </div>
  );
}
