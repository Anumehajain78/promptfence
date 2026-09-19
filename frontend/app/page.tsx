import { Architecture } from "@/components/landing/Architecture";
import { Close } from "@/components/landing/Close";
import { CurlyEdge } from "@/components/landing/CurlyEdge";
import { Decisions } from "@/components/landing/Decisions";
import { ThemeFade } from "@/components/landing/ThemeFade";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Sequence } from "@/components/landing/Sequence";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { System } from "@/components/landing/System";

// overflow-x-clip, not hidden: hidden makes the wrapper a scroll container and
// the sticky header stops sticking.
// text-ink on the themed root, not only on <body>: an inherited colour resolves where it is declared, and
// <body> is outside the themed element, so headings would otherwise keep the light theme's ink.
export default function LandingPage() {
  return (
    <div id="pf-page" className="pf-theme overflow-x-clip text-ink">
      <ThemeFade />
      <SiteHeader />
      <main>
        {/* The light page is a curtain: opaque, above the closing section, with a curly bottom edge.
            The black closing section sits still behind it and is uncovered as the curtain lifts. */}
        <div className="relative z-10 bg-paper">
          <Hero />
          <Problem />
          <System />
          <Sequence />
          <Decisions />
          <Architecture />
          <CurlyEdge />
        </div>
        <Close />
      </main>
    </div>
  );
}
