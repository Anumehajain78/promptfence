"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ActionStack } from "./ActionStack";
import { DecisionFlow } from "./DecisionFlow";
import { MaskReveal } from "./MaskReveal";
import { EASE, usePrefersReducedMotion } from "./motion";
import { Readout } from "./Readout";
import { ToolList, type Tool } from "./ToolList";
import { Display, Kicker, PAGE_X, SECTION_TOP } from "./ui";

const TOOLS: Tool[] = [
  { label: "Refunds", fn: "refund_order", consequence: "A refund can actually happen." },
  { label: "Payments", fn: "charge_card", consequence: "A payment can actually happen." },
  { label: "Emails", fn: "send_email", consequence: "An email can actually be sent." },
  { label: "Records", fn: "delete_record", consequence: "A record can actually disappear." },
  { label: "APIs", fn: "http_post", consequence: "A request can actually go out." },
];

/**
 * Heading, then the actions. By default the actions are a pinned stack you scroll
 * through (ActionStack). With prefers-reduced-motion, or on a screen too short to
 * hold the pinned frame, they are the plain interactive list instead: same
 * content, same selection, no pinning and no travel.
 */
export function Problem() {
  const reduced = usePrefersReducedMotion();
  const roomy = useRoomyViewport();
  const head = useRef<HTMLDivElement>(null);
  const headIn = useInView(head, { once: true, amount: 0.5 });
  const fade = reduced ? { duration: 0 } : { duration: 0.6, ease: EASE };

  return (
    <section id="problem" aria-label="The problem" className="scroll-mt-24 md:scroll-mt-16">
      <div className={`mx-auto max-w-[1440px] pb-[clamp(8px,1.5vw,24px)] ${PAGE_X} ${SECTION_TOP}`}>
        <div ref={head}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: headIn ? 1 : 0 }} transition={fade}>
            <Kicker>The problem</Kicker>
          </motion.div>
          <Display className="mt-[clamp(20px,3vw,40px)] text-[clamp(38px,7.6vw,124px)] leading-[0.92]">
            <MaskReveal show={headIn} delay={0.1}>
              AI used to answer.
            </MaskReveal>
            <MaskReveal show={headIn} delay={0.24} className="text-grey-400">
              Now it acts.
            </MaskReveal>
          </Display>
        </div>
        {reduced || !roomy ? <StaticActions reduced={reduced} /> : <ActionStack tools={TOOLS} />}
      </div>
    </section>
  );
}

// True unless the viewport is too short for the pinned frame. Starts true so the prerendered HTML matches.
function useRoomyViewport(): boolean {
  const [roomy, setRoomy] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-height: 600px)");
    const sync = () => setRoomy(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return roomy;
}

// The unpinned version: hover, focus or tap selects a row.
function StaticActions({ reduced }: { reduced: boolean }) {
  const list = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const who = useRef<HTMLDivElement>(null);
  const listIn = useInView(list, { once: true, amount: 0.25 });
  const copyIn = useInView(copy, { once: true, amount: 0.6 });
  const whoIn = useInView(who, { once: true, amount: 0.8 });

  const [active, setActive] = useState<number | null>(null);
  const touched = useRef(false);
  const select = (index: number) => {
    touched.current = true;
    setActive(index);
  };
  // Once the rows are in, the first tool selects itself so the readout is never empty.
  useEffect(() => {
    if (!listIn) return;
    const id = window.setTimeout(() => {
      if (!touched.current) setActive(0);
    }, reduced ? 0 : 1100);
    return () => window.clearTimeout(id);
  }, [listIn, reduced]);

  const tool = active === null ? null : TOOLS[active];

  return (
    <div className="mt-[clamp(48px,7vw,110px)] grid items-end gap-x-16 gap-y-14 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
      <div ref={list}>
        <ToolList tools={TOOLS} show={listIn} active={active} onSelect={select} />
      </div>
      <div>
        <div ref={copy}>
          <Readout tool={tool} />
          <motion.p
            className="m-0 max-w-[40ch] text-[clamp(16px,1.2vw,19px)] leading-[1.45] text-grey-700 [text-wrap:pretty]"
            initial={{ opacity: 0 }}
            animate={{ opacity: copyIn ? 1 : 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.6, delay: 0.1, ease: EASE }}
          >
            Each of these is a real tool call with a real consequence. The model can reason its way to any of them. Reasoning is not authorization.
          </motion.p>
        </div>
        <div ref={who}>
          <Display as="div" className="mt-[clamp(28px,3vw,44px)] text-[clamp(34px,4.6vw,72px)]">
            <MaskReveal show={whoIn} duration={0.8}>
              Who decides?
            </MaskReveal>
          </Display>
        </div>
        <div className="mt-[clamp(24px,3vw,40px)] pb-7">
          <DecisionFlow request={tool?.fn} />
        </div>
      </div>
    </div>
  );
}
