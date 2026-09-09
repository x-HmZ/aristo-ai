import { CapabilityStrip } from "@/components/landing/CapabilityStrip";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { FinalCta } from "@/components/landing/FinalCta";
import { ForParents } from "@/components/landing/ForParents";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingNav } from "@/components/landing/LandingNav";
import { SiteFooter } from "@/components/landing/SiteFooter";

/**
 * The landing page is a server component; only `Reveal` (the scroll-in
 * wrapper each section uses) crosses into the client. Nothing here imports
 * three / @react-three — the 3D classroom is shown as still captures of
 * /demo under public/images/landing, never as a live scene.
 */
export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* Without JS the IntersectionObserver in Reveal never fires, so the
          scroll-reveal start state would leave the page blank. */}
      <noscript>
        <style>{".landing-reveal{opacity:1;transform:none}"}</style>
      </noscript>

      {/* Ambient warmth — the same pale-orange wash the classroom sits in. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-56 size-[760px] rounded-full bg-[radial-gradient(circle,hsl(var(--aristo-orange-pale)/0.85)_0%,hsl(var(--aristo-cream)/0)_68%)]" />
        <div className="absolute -left-56 top-64 size-[620px] rounded-full bg-[radial-gradient(circle,hsl(var(--aristo-orange-light)/0.30)_0%,hsl(var(--aristo-cream)/0)_70%)]" />
      </div>

      <header>
        <LandingNav />
      </header>

      <main>
        <Hero />
        <CapabilityStrip />
        <HowItWorks />
        <FeatureGrid />
        <ForParents />
        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  );
}
