"use client";

import { useEffect, useRef } from "react";
import { inr } from "@/lib/format";
import { Reveal } from "./Reveal";
import { gsap, ScrollTrigger, PIN_MIN_WIDTH, prefersReducedMotion } from "./gsapSetup";
import { Display, Kicker, PAGE_X, SECTION_Y } from "./ui";

type Tone = "ink" | "allow";
interface Layer {
  n: string;
  name: string;
  kicker: string;
  lines: [string, string, Tone?][];
}

// Following request #12: an ordinary ₹9,000 refund that is allowed. The session
// has refunded ₹99,000 so far, so this one lands at ₹1,08,000 — far under the
// ₹3,55,000 ceiling. The blocked request #40 is section 04's story, not this one.
const REQUEST = { seq: "#12", action: "refund", amount: 9000, customer: "#4474" };

const LAYERS: Layer[] = [
  { n: "01", name: "PromptFence", kicker: "Intercept", lines: [["event", "Request received"], ["request", "#12"], ["ts", "14:01:12.470"], ["tool call", "Held"]] },
  {
    n: "02",
    name: "Cedar",
    kicker: "Policy",
    lines: [["policy", "allow-support-refund-small"], ["rule", "permit if amount ≤ 10,000"], ["amount", inr(9000)]],
  },
  {
    n: "03",
    name: "Session context",
    kicker: "DynamoDB",
    lines: [["session", "CUST-4474"], ["previous_total", inr(99000)], ["prior requests", "11 allowed"], ["projected", inr(108000)]],
  },
  { n: "04", name: "Decision", kicker: "Output", lines: [["decision", "Allow", "allow"], ["policy", "allow-support-refund-small"], ["approval path", "not required"]] },
  { n: "05", name: "Real tool", kicker: "refund()", lines: [["execution", "Called", "allow"], ["result", "refund processed"], ["session total", inr(108000)]] },
];

function RequestCard({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-baseline gap-3 rounded border border-ink bg-paper px-3.5 py-2.5 font-mono text-[13px] whitespace-nowrap ${className}`}>
      <span className="font-medium">{REQUEST.seq}</span>
      <span>{REQUEST.action}()</span>
      <span className="text-grey-500">
        {inr(REQUEST.amount)} · {REQUEST.customer}
      </span>
    </div>
  );
}

function Panel({ layer, last }: { layer: Layer; last: boolean }) {
  return (
    <div
      data-panel
      className="flex min-w-0 flex-col border-t-2 border-grey-200 px-4 py-5 opacity-45 md:border-r md:border-r-grey-200 md:last:border-r-0"
    >
      <div className="text-[13px] text-grey-500">
        <span className="font-mono">{layer.n}</span> — {layer.kicker}
      </div>
      <div data-panel-name className="mt-2 text-[clamp(20px,2.2vw,30px)] font-medium leading-tight tracking-[-0.03em]">
        {layer.name}
      </div>
      <dl className="m-0 mt-4 text-[13px]">
        {layer.lines.map(([k, v, tone]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-grey-100 py-1.5">
            <dt className="text-grey-500">{k}</dt>
            <dd
              data-panel-value={last && tone === "allow" ? "arrival" : undefined}
              className={`m-0 truncate text-right font-mono tabular-nums ${tone === "allow" ? "text-allow" : "text-ink"}`}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function System() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const media = gsap.matchMedia();

      // Desktop: pin the section and walk the card across the panels as you scroll.
      media.add(`(min-width: ${PIN_MIN_WIDTH}px)`, () => {
        const panels = gsap.utils.toArray<HTMLElement>("[data-panel]");
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: "[data-pin]",
            start: "top top",
            end: "+=250%",
            pin: true,
            scrub: true,
            anticipatePin: 1,
          },
        });
        // Travel the full width of the track, minus the card's own width.
        const travel = () => {
          const track = root.current!.querySelector<HTMLElement>("[data-track]")!;
          const card = root.current!.querySelector<HTMLElement>("[data-card]")!;
          return Math.max(0, track.offsetWidth - card.offsetWidth);
        };
        timeline.to("[data-card]", { x: travel, ease: "none", duration: panels.length });
        panels.forEach((panel, i) => {
          timeline.to(panel, { opacity: 1, borderTopColor: "#B8F227", duration: 0.25, ease: "none" }, i * 0.85);
        });
        // The last panel turns green as the card arrives.
        timeline.to("[data-panel]:last-child [data-panel-name]", { color: "#128A60", duration: 0.2, ease: "none" }, panels.length - 0.6);
      });

      // Mobile: no pin — the panels simply reveal as they enter.
      media.add(`(max-width: ${PIN_MIN_WIDTH - 1}px)`, () => {
        gsap.utils.toArray<HTMLElement>("[data-panel]").forEach((panel) => {
          gsap.to(panel, {
            opacity: 1,
            borderTopColor: "#B8F227",
            duration: 0.4,
            ease: "power1.out",
            scrollTrigger: { trigger: panel, start: "top 85%", once: true },
          });
        });
      });

      return () => media.revert();
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} id="system" aria-label="The system" className="scroll-mt-16 border-t border-grey-200">
      <div className={`mx-auto max-w-[1440px] ${PAGE_X} ${SECTION_Y}`}>
        <Reveal>
          <Kicker n="03" aside={<span>Following request <span className="font-mono">#12</span></span>}>
            The system
          </Kicker>
          <div className="mt-[clamp(20px,3vw,40px)] grid items-end gap-x-16 gap-y-8 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
            <Display className="text-[clamp(38px,6.6vw,108px)] leading-[0.92]">
              One request.
              <br />
              Five layers.
              <br />
              <span className="text-grey-400">One decision.</span>
            </Display>
            <p className="m-0 max-w-[40ch] text-[clamp(16px,1.2vw,19px)] leading-[1.45] text-grey-700 [text-wrap:pretty]">
              Every action an agent wants to take passes through the same path. The agent never talks to the tool. It talks to the fence. Scroll to follow one request through.
            </p>
          </div>
        </Reveal>
      </div>

      <div data-pin className="mx-auto max-w-[1440px] pb-[clamp(40px,6vw,96px)]">
        <div className={PAGE_X}>
          {/* The travelling request. On mobile it simply sits above the panels. */}
          <div data-track className="relative h-14 overflow-hidden border-b border-grey-200 md:overflow-visible">
            <div data-card className="absolute left-0 top-2">
              <RequestCard />
            </div>
          </div>
          <div className="grid md:grid-cols-5">
            {LAYERS.map((layer, i) => (
              <Panel key={layer.n} layer={layer} last={i === LAYERS.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
