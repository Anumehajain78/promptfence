"use client";

import { useEffect, useRef } from "react";
import { Reveal } from "./Reveal";
import { gsap, prefersReducedMotion } from "./gsapSetup";
import { Display, Kicker, PAGE_X, SECTION_Y } from "./ui";

// Only services the backend runs (backend/template.yaml). The design also listed
// Step Functions for approval & execution; that is not built, so it is omitted.
const NODES = [
  { n: "01", name: "Strands + Bedrock", job: "Agent runtime" },
  { n: "02", name: "API Gateway", job: "Every tool call enters" },
  { n: "03", name: "Lambda", job: "Runs the fence" },
  { n: "04", name: "PromptFence", job: "Allow · Deny · Approval", fence: true },
  { n: "05", name: "Real tool", job: "Called only on Allow", jobTone: "text-allow" },
];

const FENCE_PARTS = [
  { name: "Cedar", job: "policy evaluation" },
  { name: "DynamoDB", job: "session context" },
  { name: "EventBridge", job: "decision events" },
];

const ROW = 96; // px between node centres in the SVG's coordinate space

export function Architecture() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const path = root.current!.querySelector<SVGPathElement>("[data-spine]")!;
      const length = path.getTotalLength();
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      const timeline = gsap.timeline({ scrollTrigger: { trigger: "[data-diagram]", start: "top 75%", once: true } });
      // The line draws from the top down…
      timeline.to(path, { strokeDashoffset: 0, duration: 1.2, ease: "none" });
      // …and each label appears as the line reaches it.
      timeline.from(
        "[data-node]",
        { opacity: 0, duration: 0.25, ease: "power1.out", stagger: 1.2 / NODES.length },
        0,
      );
      timeline.from("[data-dot]", { opacity: 0, duration: 0.2, stagger: 1.2 / NODES.length }, 0);
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} id="aws" aria-label="Architecture" className="border-t border-grey-200">
      <div className={`mx-auto max-w-[1440px] ${PAGE_X} ${SECTION_Y}`}>
        <Kicker n="06" aside={<span>Only the services we run</span>}>
          Architecture
        </Kicker>
        <div className="mt-[clamp(20px,3vw,40px)] grid items-start gap-x-16 gap-y-10 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <Reveal>
            <Display className="text-[clamp(38px,6.6vw,108px)] leading-[0.92]">
              Runs on AWS.
              <br />
              <span className="text-grey-400">
                One path.
                <br />
                No bypass.
              </span>
            </Display>
          </Reveal>

          <div data-diagram className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-4">
            {/* The spine: one path, drawn top to bottom as the section enters. */}
            <svg
              aria-hidden
              viewBox={`0 0 24 ${ROW * NODES.length}`}
              preserveAspectRatio="none"
              className="absolute inset-y-0 left-0 h-full w-6"
            >
              <path data-spine d={`M12,8 V${ROW * NODES.length - 8}`} className="stroke-ink" strokeWidth={2} vectorEffect="non-scaling-stroke" fill="none" />
            </svg>

            <div className="col-start-2 border-t border-ink">
              {NODES.map((node) => (
                <div key={node.n} className="relative border-b border-grey-200 py-[18px]">
                  <span
                    data-dot
                    aria-hidden
                    className={`absolute -left-[22px] top-[26px] block h-2.5 w-2.5 outline outline-[3px] outline-paper ${node.fence ? "bg-lime" : "bg-ink"}`}
                  />
                  <div data-node className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-baseline gap-4">
                    <span className="font-mono text-[13px] tabular-nums text-grey-500">{node.n}</span>
                    <span className={`text-[clamp(18px,1.6vw,24px)] tracking-[-0.02em] ${node.fence ? "font-semibold" : "font-medium"}`}>
                      {node.name}
                    </span>
                    <span className={`text-right text-[13px] ${node.jobTone ?? (node.fence ? "text-ink" : "text-grey-500")}`}>{node.job}</span>
                  </div>
                  {node.fence && (
                    <div data-node className="mt-3.5 grid gap-2 border-l-[3px] border-lime pl-4 text-[13px] leading-normal">
                      {FENCE_PARTS.map((part) => (
                        <div key={part.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
                          <span className="font-medium">{part.name}</span>
                          <span className="text-right text-grey-500">{part.job}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
