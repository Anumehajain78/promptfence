"use client";

import { useEffect, useState } from "react";
import { REFUND_CEILING } from "@/lib/api";
import { inr } from "@/lib/format";
import { Reveal } from "./Reveal";
import { Display, Kicker, PAGE_X, SECTION_Y } from "./ui";
import { useInViewOnce } from "./useInView";

type Tone = "ink" | "deny";
interface Layer {
  n: string;
  name: string;
  kicker: string;
  lines: [string, string, Tone?][];
}

// Following request #40. Numbers match the backend: ₹3,51,000 already refunded,
// ₹9,000 more would reach ₹3,60,000, above the ₹3,55,000 ceiling.
const LAYERS: Layer[] = [
  { n: "01", name: "AI agent", kicker: "Strands · Bedrock", lines: [["agent", "support-agent"], ["intent", "refund"], ["amount", inr(9000)], ["customer", "#4474"]] },
  { n: "02", name: "PromptFence", kicker: "Intercept", lines: [["event", "Request received"], ["request", "#40"], ["ts", "14:02:31.114"], ["tool call", "Held"]] },
  {
    n: "03",
    name: "Cedar",
    kicker: "Policy",
    lines: [["policy", "cumulative-refund-ceiling-v1"], ["rule", "forbid if total + amount > limit"], ["limit", inr(REFUND_CEILING)]],
  },
  {
    n: "04",
    name: "Session context",
    kicker: "DynamoDB",
    lines: [["session", "CUST-4474"], ["previous_total", inr(351000)], ["prior requests", "39 allowed"], ["projected", inr(360000), "deny"]],
  },
  { n: "05", name: "Decision", kicker: "Output", lines: [["decision", "Deny", "deny"], ["reason", "Cumulative session limit exceeded"], ["approval path", "not applicable"]] },
  { n: "06", name: "Real tool", kicker: "refund()", lines: [["execution", "Not called", "deny"], ["side effects", "none"], ["attack", "stopped at the fence"]] },
];

function LayerRow({ layer, index, on, onEnter }: { layer: Layer; index: number; on: boolean; onEnter: (i: number) => void }) {
  const [ref, entered] = useInViewOnce<HTMLDivElement>({ threshold: 0.6 });
  useEffect(() => {
    if (entered) onEnter(index);
  }, [entered, index, onEnter]);
  const bad = index >= 4;
  return (
    <div
      ref={ref}
      className="relative grid gap-x-[clamp(20px,4vw,64px)] gap-y-5 border-b border-grey-200 py-[clamp(28px,4vw,56px)] pl-[clamp(22px,4vw,56px)] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      {/* Rail segment and node for this layer. */}
      <span aria-hidden className={`absolute bottom-0 left-0 top-0 w-0.5 transition-colors duration-[400ms] ${on ? (bad ? "bg-deny-fill" : "bg-lime") : "bg-grey-200"}`} />
      <span
        aria-hidden
        className={`absolute -left-[5px] top-[calc(clamp(28px,4vw,56px)+26px)] h-3 w-3 outline outline-[3px] outline-paper transition-colors duration-[400ms] ${
          on ? (bad ? "bg-deny-fill" : "bg-lime") : "bg-grey-200"
        }`}
      />
      <div>
        <div className="text-[13px] text-grey-500">
          <span className="font-mono">{layer.n}</span> — {layer.kicker}
        </div>
        <div
          className={`mt-2.5 text-[clamp(28px,4.2vw,64px)] font-medium leading-[0.95] tracking-[-0.04em] transition-colors duration-[400ms] ${
            on ? "text-ink" : "text-grey-300"
          }`}
        >
          {layer.name}
        </div>
      </div>
      <dl
        className={`m-0 flex flex-col self-end text-[13px] leading-relaxed transition-[opacity,transform] duration-[400ms] ${
          on ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {layer.lines.map(([k, v, tone]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-grey-100 py-[7px]">
            <dt className="text-grey-500">{k}</dt>
            <dd className={`m-0 text-right font-mono font-medium tabular-nums ${tone === "deny" ? "text-deny" : "text-ink"}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function System() {
  // Highest layer reached so far. Every layer up to it is lit, so jumping past a
  // layer (anchor link, fast scroll) never leaves an earlier one dark.
  const [reached, setReached] = useState(-1);
  const onEnter = useState(() => (i: number) => setReached((r) => Math.max(r, i)))[0];
  return (
    <section id="system" aria-label="The system" className="scroll-mt-16 border-t border-grey-200">
      <div className={`mx-auto max-w-[1440px] ${PAGE_X} ${SECTION_Y}`}>
        <Reveal>
          <Kicker n="03" aside={<span>Following request <span className="font-mono">#40</span></span>}>
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
        <div className="mt-[clamp(48px,6vw,96px)] border-t border-ink">
          {LAYERS.map((layer, i) => (
            <LayerRow key={layer.n} layer={layer} index={i} on={i <= reached} onEnter={onEnter} />
          ))}
        </div>
      </div>
    </section>
  );
}
