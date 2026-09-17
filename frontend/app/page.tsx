import { Architecture } from "@/components/landing/Architecture";
import { Close } from "@/components/landing/Close";
import { Decisions } from "@/components/landing/Decisions";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Sequence } from "@/components/landing/Sequence";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { System } from "@/components/landing/System";

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden">
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <System />
        <Sequence />
        <Decisions />
        <Architecture />
        <Close />
      </main>
    </div>
  );
}
