"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/components/control-room/useReducedMotion";
import { Reveal } from "./Reveal";
import { Display, Kicker, PAGE_X, SECTION_Y } from "./ui";

// One example per outcome, each with its own policy and its own reason.
const PATHS = [
  {
    id: "allow",
    call: "refund()",
    detail: "₹9,000 · #4474",
    word: "Allow",
    tone: "text-allow",
    rule: "border-t-allow-fill",
    policy: "allow-support-refund-small",
    reason: "Within the ₹10,000 per-call limit for support agents.",
    outcome: "Real tool",
    outcomeNote: "executed",
  },
  {
    id: "approval",
    call: "refund()",
    detail: "₹42,000 · #4474",
    word: "Approval",
    tone: "text-amber",
    rule: "border-t-amber-fill",
    policy: "hold-support-refund-large",
    reason: "Above ₹10,000 — held at the fence for a human.",
    outcome: "Human",
    outcomeNote: "approve · deny",
  },
  {
    id: "deny",
    call: "delete_customer()",
    detail: "#CUST-4474",
    word: "Deny",
    tone: "text-deny",
    rule: "border-t-deny-fill",
    policy: "forbid-support-delete",
    reason: "Never permitted for support-agent.",
    outcome: "Stop",
    outcomeNote: "tool not called",
  },
];

const SPRING = { type: "spring" as const, stiffness: 220, damping: 26 };

export function Decisions() {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section id="decisions" aria-label="Three decisions" className="border-t border-grey-200">
      <div className={`mx-auto max-w-[1440px] ${PAGE_X} ${SECTION_Y}`}>
        <Reveal>
          <Kicker n="05" aside={<span>Hover or tap a path</span>}>
            Three decisions
          </Kicker>
          <Display className="mt-[clamp(20px,3vw,40px)] text-[clamp(38px,6.6vw,108px)] leading-[0.92]">
            Every request
            <br />
            ends one of
            <br />
            <span className="text-grey-400">three ways.</span>
          </Display>
        </Reveal>

        <div className="mt-[clamp(40px,5vw,72px)] flex flex-col gap-4 md:flex-row" onMouseLeave={() => setHovered(null)}>
          {PATHS.map((p, i) => {
            const dim = hovered !== null && hovered !== p.id;
            return (
              <motion.div
                key={p.id}
                tabIndex={0}
                aria-label={`${p.word}: ${p.call}`}
                onMouseEnter={() => setHovered(p.id)}
                onFocus={() => setHovered(p.id)}
                onBlur={() => setHovered(null)}
                initial={reducedMotion ? false : { opacity: 0, y: 40 }}
                whileInView={reducedMotion ? undefined : { opacity: dim ? 0.45 : 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                animate={reducedMotion ? undefined : { opacity: dim ? 0.45 : 1, flexGrow: hovered === p.id ? 1.6 : 1 }}
                transition={reducedMotion ? { duration: 0 } : { ...SPRING, delay: hovered === null ? i * 0.12 : 0 }}
                className={`flex flex-1 basis-0 cursor-pointer flex-col border-t-2 ${p.rule} bg-paper px-4 py-5 outline-offset-2`}
              >
                <div className="font-mono text-[13px] font-medium">{p.call}</div>
                <div className="font-mono text-[13px] text-grey-500">{p.detail}</div>
                <div className={`mt-3 text-[clamp(20px,2.2vw,32px)] font-medium leading-none tracking-[-0.03em] ${p.tone}`}>{p.word}</div>
                <div className="mt-4 border-t border-grey-100 pt-3 font-mono text-xs text-grey-500">{p.policy}</div>
                <p className="m-0 mt-2 text-[13px] leading-normal text-grey-700 [text-wrap:pretty]">{p.reason}</p>
                <div className="mt-auto pt-6">
                  <div className="text-[clamp(18px,2vw,26px)] font-medium leading-none tracking-[-0.03em]">{p.outcome}</div>
                  <div className="mt-1.5 text-[13px] text-grey-500">{p.outcomeNote}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <Reveal>
          <p className="m-0 mt-[clamp(24px,3vw,40px)] max-w-[52ch] text-[clamp(15px,1.1vw,17px)] leading-normal text-grey-700 [text-wrap:pretty]">
            One fence, three outcomes. Allowed requests cross to the real tool. Denied requests stop at the boundary and the tool is never called. Requests that need a person wait at the fence until a human approves or denies.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
