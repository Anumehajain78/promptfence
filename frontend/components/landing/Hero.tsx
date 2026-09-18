"use client";

import { useEffect, useRef, useState } from "react";
import { DecisionStream } from "./DecisionStream";
import { gsap, prefersReducedMotion } from "./gsapSetup";
import { DASHBOARD, DASHBOARD_ATTACK, Display, Kicker, PAGE_X, PrimaryLink, SecondaryLink } from "./ui";

const LINE_ONE = "AI can reason.";
const TYPE_MS = 600;
const PAUSE_MS = 250;
const LINE_TWO_MS = 300;

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const [streamRunning, setStreamRunning] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setStreamRunning(true);
      return;
    }
    const ctx = gsap.context(() => {
      const chars = gsap.utils.toArray<HTMLElement>("[data-type-char]");
      const timeline = gsap.timeline({ onComplete: () => setStreamRunning(true) });
      // "AI can reason." types in character by character…
      timeline.set(chars, { opacity: 0 }).to(chars, { opacity: 1, duration: 0.01, stagger: TYPE_MS / 1000 / chars.length });
      // …then the second line arrives in one motion.
      timeline.from(
        "[data-hero-line-two]",
        { scale: 1.15, opacity: 0, duration: LINE_TWO_MS / 1000, ease: "expo.out", transformOrigin: "left center" },
        `+=${PAUSE_MS / 1000}`,
      );
      timeline.from("[data-hero-cta]", { opacity: 0, duration: 0.3, ease: "power1.out" }, "-=0.1");
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      id="top"
      ref={root}
      aria-label="Hero"
      className={`mx-auto max-w-[1440px] pb-[clamp(64px,7vw,96px)] pt-[clamp(56px,8vw,112px)] ${PAGE_X}`}
    >
      <Kicker
        n="01"
        aside={
          <span className="flex gap-[18px] font-medium">
            <span className="text-allow">Allow</span>
            <span className="text-deny">Deny</span>
            <span className="text-amber">Approval</span>
          </span>
        }
      >
        A security control layer for AI agents
      </Kicker>
      <Display as="h1" className="mt-[clamp(28px,4vw,56px)] text-[clamp(40px,9.4vw,152px)] leading-[0.92]">
        {/* The characters keep their space while hidden, so nothing reflows. */}
        <span aria-label={LINE_ONE}>
          {LINE_ONE.split("").map((char, i) => (
            <span key={i} data-type-char aria-hidden className="inline-block whitespace-pre">
              {char}
            </span>
          ))}
        </span>
        <br />
        <span data-hero-line-two className="inline-block">
          PromptFence decides.
        </span>
      </Display>
      <div className="mt-[clamp(32px,4vw,56px)] grid items-end gap-x-12 gap-y-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <p className="m-0 max-w-[44ch] text-[clamp(17px,1.35vw,21px)] leading-snug text-grey-700 [text-wrap:pretty]">
          A security control layer between AI agents and the actions they are allowed to take. The model proposes. Policy decides. The tool only runs when it should.
        </p>
        <div data-hero-cta className="flex flex-wrap gap-3 lg:justify-end">
          <PrimaryLink href={DASHBOARD_ATTACK}>Run attack simulation</PrimaryLink>
          <SecondaryLink href={DASHBOARD}>Enter the Control Room →</SecondaryLink>
        </div>
      </div>
      <DecisionStream running={streamRunning} />
    </section>
  );
}
