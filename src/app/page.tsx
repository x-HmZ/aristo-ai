import { CapabilityStrip } from "@/components/landing/CapabilityStrip";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { FinalCta } from "@/components/landing/FinalCta";
import { ForParents } from "@/components/landing/ForParents";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingNav } from "@/components/landing/LandingNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { displayFont } from "@/components/landing/fonts";
import { cn } from "@/lib/utils";

/**
 * The landing page is a server component; only `Reveal` (the scroll-in
 * wrapper each section uses) and `ThemeToggle` cross into the client. Nothing
 * here imports three / @react-three: the 3D classroom is shown as still
 * captures of /demo under public/images/landing, never as a live scene.
 *
 * Colours are the app-wide semantic tokens (light and dark, see globals.css
 * and .claude/docs/brand-system.md). The theme script lives in the root
 * layout. No stylesheet rule reads `.landing` any more; it only names the
 * page root.
 */
export default function HomePage() {
  return (
    <div
      className={cn(
        displayFont.variable,
        "landing relative min-h-screen overflow-x-hidden bg-bg text-ink"
      )}
    >
      {/* Without JS the IntersectionObserver in Reveal never fires, so the
          scroll-reveal start state would leave the page blank. */}
      <noscript>
        <style>{".landing-reveal{opacity:1;transform:none}"}</style>
      </noscript>

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
