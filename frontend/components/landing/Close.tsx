"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "./gsapSetup";
import { DASHBOARD, DASHBOARD_ATTACK, Display, Kicker, PAGE_X, PrimaryLink, SecondaryLink, StopMark } from "./ui";

export function Close() {
  const root = useRef<HTMLElement>(null);
  // Drives the paper → ink crossfade. Stays false under reduced motion, so the
  // section simply reads as the rest of the page does.
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 60%", once: true } });
      timeline.add(() => setDark(true));
      // The two ends of the request drift apart from the centre.
      timeline.from("[data-drift-left]", { xPercent: 240, duration: 1.5, ease: "power3.out" }, 0);
      timeline.from("[data-drift-right]", { xPercent: -240, duration: 1.5, ease: "power3.out" }, 0);
      timeline.from("[data-close-cta]", { opacity: 0, duration: 0.4, ease: "power1.out" }, "-=0.3");
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      aria-label="Close"
      className={`border-t transition-colors duration-500 ${dark ? "border-grey-700 bg-ink text-paper" : "border-grey-200 bg-paper text-ink"}`}
    >
      <div className={`mx-auto max-w-[1440px] pb-[clamp(64px,7vw,96px)] pt-[clamp(96px,13vw,200px)] ${PAGE_X}`}>
        <div className={`text-[13px] transition-colors duration-500 ${dark ? "text-grey-300" : "text-grey-500"}`}>
          <Kicker n="07">The tool never ran</Kicker>
        </div>
        <Display className="mt-[clamp(20px,3vw,40px)] text-[clamp(38px,7.6vw,124px)] font-normal leading-[0.92]">
          The most important call
          <br />
          was the one
          <br />
          <span className={dark ? "text-grey-400" : "text-grey-400"}>we didn&rsquo;t make.</span>
        </Display>

        <div aria-hidden className="mt-[clamp(40px,5vw,72px)] flex max-w-[720px] items-center gap-3.5 text-[13px]">
          <span data-drift-left className="flex flex-1 items-center gap-3.5">
            <span>AI</span>
            <span className={`h-0.5 flex-1 transition-colors duration-500 ${dark ? "bg-paper" : "bg-ink"}`} />
          </span>
          <span className={`h-14 w-0.5 transition-colors duration-500 ${dark ? "bg-paper" : "bg-ink"}`} />
          <StopMark />
          <span data-drift-right className="flex flex-1 items-center gap-3.5">
            <span className="h-0 flex-1 border-t border-dashed border-grey-250" />
            <span className="text-grey-400">Real tool</span>
          </span>
        </div>

        <div data-close-cta className="mt-[clamp(40px,5vw,72px)] flex flex-wrap gap-3">
          <PrimaryLink href={DASHBOARD}>Enter the Control Room →</PrimaryLink>
          <SecondaryLink href={DASHBOARD_ATTACK} inverted={dark}>
            Replay the attack
          </SecondaryLink>
        </div>

        <footer
          className={`mt-[clamp(72px,9vw,140px)] flex flex-wrap justify-between gap-4 border-t pt-5 text-[13px] transition-colors duration-500 ${
            dark ? "border-grey-700 text-grey-300" : "border-grey-200 text-grey-500"
          }`}
        >
          <span className={`flex items-center gap-2.5 ${dark ? "text-paper" : "text-ink"}`}>
            <span aria-hidden className={`block h-3.5 w-0.5 transition-colors duration-500 ${dark ? "bg-paper" : "bg-ink"}`} />
            PromptFence
          </span>
          <span>AI can reason. PromptFence decides.</span>
          <span>Cedar · DynamoDB · EventBridge</span>
        </footer>
      </div>
    </section>
  );
}
