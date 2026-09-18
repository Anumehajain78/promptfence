"use client";

import { useEffect, useRef } from "react";
import { Reveal } from "./Reveal";
import { gsap, ScrollTrigger, prefersReducedMotion } from "./gsapSetup";
import { Display, Kicker, PAGE_X, SECTION_Y } from "./ui";

const ACTIONS = [
  ["Refunds", "refund_order"],
  ["Payments", "charge_card"],
  ["Emails", "send_email"],
  ["Records", "delete_record"],
  ["APIs", "http_post"],
];

export function Problem() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const chips = gsap.utils.toArray<HTMLElement>("[data-chip]");
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: "[data-chips]", start: "top 80%", once: true },
      });
      // Each chip arrives from a random direction and settles into place.
      timeline.from(chips, {
        x: () => gsap.utils.random(-400, 400),
        y: () => gsap.utils.random(-400, 400),
        rotation: () => gsap.utils.random(-20, 20),
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.08,
      });
      // The closing sentence follows on its own.
      timeline.from("[data-closing]", { y: 16, opacity: 0, duration: 0.3, ease: "power1.out" }, "+=0.3");
      return () => ScrollTrigger.getAll().forEach((t) => t.kill());
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} aria-label="The problem" className="border-t border-grey-200">
      <div className={`mx-auto max-w-[1440px] ${PAGE_X} ${SECTION_Y}`}>
        <Reveal>
          <Kicker n="02">The problem</Kicker>
          <Display className="mt-[clamp(20px,3vw,40px)] text-[clamp(38px,7.6vw,124px)] leading-[0.92]">
            AI used to answer.
            <br />
            <span className="text-grey-400">Now it acts.</span>
          </Display>
        </Reveal>
        <div className="mt-[clamp(48px,7vw,110px)] grid items-end gap-x-16 gap-y-14 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          <div data-chips className="border-t border-ink">
            {ACTIONS.map(([label, fn]) => (
              <div key={fn} data-chip className="flex items-baseline justify-between gap-4 border-b border-grey-200 py-4">
                <span className="text-[clamp(36px,6vw,96px)] font-light leading-none tracking-[-0.035em]">{label}</span>
                <span className="font-mono text-[13px] text-grey-500">{fn}</span>
              </div>
            ))}
          </div>
          <p data-closing className="m-0 max-w-[40ch] text-[clamp(16px,1.2vw,19px)] leading-[1.45] text-grey-700 [text-wrap:pretty]">
            Each of these is a real tool call with a real consequence. The model can reason its way to any of them. Reasoning is not authorization.
          </p>
        </div>
      </div>
    </section>
  );
}
