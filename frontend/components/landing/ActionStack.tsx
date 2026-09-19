"use client";

import { motion, useInView, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { scrollToY } from "@/components/site/SmoothScroll";
import { DecisionFlow } from "./DecisionFlow";
import { MaskReveal } from "./MaskReveal";
import { EASE } from "./motion";
import { Readout } from "./Readout";
import type { Tool } from "./ToolList";
import { Display } from "./ui";

// Where in the pinned scroll the first and last action sit, and where the story hands over to "Who decides?".
const FIRST_AT = 0.05;
const LAST_AT = 0.78;
const HANDOVER_AT = 0.88;

const PEEK = 12; // px of each passed plate left showing behind the active one
const SHRINK = 0.035; // each passed plate is this much narrower than the one in front

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// 0 = the quiet colour, 1 = ink.
const towardInk = (quiet: string) => (amount: number) => `color-mix(in srgb, var(--c-ink) ${Math.round(amount * 100)}%, var(${quiet}))`;

// Hold on each action, then move: the stack reorganises between stops instead of drifting with the wheel.
function dwell(position: number, last: number) {
  const index = Math.min(Math.floor(position), last);
  const t = clamp01((position - index - 0.3) / 0.4);
  return index + t * t * (3 - 2 * t);
}

/**
 * The actions as a physical stack you scroll through. The section pins; scroll
 * progress picks the active action. The next plate slides up over the current
 * one, which steps back and stays visible as a narrower hairline behind it, so by
 * the end the whole action surface is stacked behind the last plate.
 *
 * At the end a hairline runs from the active plate to the agent in "Who
 * decides?" and the request animation takes over: the agent can reach every one
 * of these, and the fence decides which calls land.
 *
 * One scroll progress value, smoothed by an overdamped spring, drives every
 * plate through transforms and colour. Scrolling is never hijacked.
 */
export function ActionStack({ tools }: { tools: Tool[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const last = tools.length - 1;

  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  const target = useTransform(scrollYProgress, (v) => dwell(clamp01((v - FIRST_AT) / (LAST_AT - FIRST_AT)) * last, last));
  const position = useSpring(target, { stiffness: 260, damping: 34, mass: 0.5 }); // overdamped: settles, never bounces

  const [active, setActive] = useState(0);
  useMotionValueEvent(position, "change", (v) => setActive(Math.min(last, Math.max(0, Math.round(v)))));

  // Handover: connector first, then the diagram assembles. One way; scrolling back keeps it.
  const [handover, setHandover] = useState(false);
  const [flowArmed, setFlowArmed] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (v >= HANDOVER_AT) setHandover(true);
  });
  useEffect(() => {
    if (scrollYProgress.get() >= HANDOVER_AT) setHandover(true); // loaded or jumped past the end
  }, [scrollYProgress]);
  useEffect(() => {
    if (!handover) return;
    const id = window.setTimeout(() => setFlowArmed(true), 850);
    return () => window.clearTimeout(id);
  }, [handover]);

  const show = useInView(stage, { once: true, amount: 0.3 });

  // Click or keyboard focus on a plate scrolls to its stop; the scroll is still what selects it.
  const jump = (index: number) => {
    const el = wrap.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    scrollToY(top + travel * (FIRST_AT + (index / last) * (LAST_AT - FIRST_AT)));
  };

  const who = useRef<HTMLDivElement>(null);
  const whoIn = useInView(who, { once: true, amount: 0.8 });

  return (
    <>
      {/* The frame centres its composition, so it unpins trailing half of its free height as blank paper.
          The negative margin lets the next section start inside that blank instead of after it. From lg up
          the stack has also collapsed by then, leaving the left column empty below the last plate, so the
          pull goes most of one plate further (the right column always ends at least that far above it). */}
      <div
        ref={wrap}
        className="relative mt-[clamp(32px,5vw,72px)] h-[300svh] [--fs:clamp(36px,6vw,96px)] [--plate:calc(var(--fs)+34px)] md:-mb-[max(0px,calc((100vh-62px-var(--plate)*5-49px)/2-24px))] md:h-[340vh] lg:-mb-[calc(max(0px,(100vh-62px-var(--plate)*5-49px)/2-24px)+var(--plate)*0.8)]"
      >
        <div
          ref={stage}
          className="sticky top-[96px] grid h-[calc(100svh-96px)] content-start gap-x-[64px] gap-y-6 overflow-hidden pt-[clamp(8px,2vh,32px)] md:top-[62px] md:h-[calc(100vh-62px)] md:grid-cols-2 md:pb-[clamp(8px,2vh,32px)] md:[align-content:safe_center]"
        >
          {/* The stack. Its top 48px is where passed plates stay showing. Clipped, so on a short phone the
              plates still waiting below can never run into the readout. */}
          <ul className="relative m-0 h-[min(calc(var(--plate)*5+49px),calc(100svh-316px))] list-none overflow-hidden p-0 md:h-[calc(var(--plate)*5+49px)]">
            {tools.map((tool, i) => (
              <Plate
                key={tool.fn}
                tool={tool}
                index={i}
                isLast={i === last}
                position={position}
                active={active === i}
                show={show}
                onJump={() => jump(i)}
              />
            ))}
          </ul>

          {/* self-start: the column is exactly as tall as its content, which is what the connector measures from. */}
          <div className="relative md:self-start md:pt-[48px]">
            <Readout tool={tools[active]} />
            <motion.p
              className="m-0 max-w-[40ch] text-[clamp(16px,1.2vw,19px)] leading-[1.45] text-grey-700 [text-wrap:pretty]"
              initial={{ opacity: 0 }}
              animate={{ opacity: show ? 1 : 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
            >
              Each of these is a real tool call with a real consequence. The model can reason its way to any of them. Reasoning is not authorization.
            </motion.p>

            {/* From md up the story ends inside the pinned frame: the active plate is wired into the agent. */}
            <div className="hidden md:block">
              <Display as="div" className="mt-[clamp(28px,3vw,44px)] text-[clamp(34px,4.6vw,72px)]">
                <MaskReveal show={handover} delay={0.3} duration={0.8}>
                  Who decides?
                </MaskReveal>
              </Display>
              <div className="mt-[clamp(24px,3vw,40px)] flex h-[100px] items-center">
                <div className="w-full">
                  <DecisionFlow armed={flowArmed} request={tools[active].fn} />
                </div>
              </div>
              <Connector drawn={handover} />
            </div>
          </div>
        </div>
      </div>

      {/* On phones the pinned frame holds the stack and its readout; the system follows in the normal flow. */}
      <div ref={who} className="pb-7 md:hidden">
        <Display as="div" className="mt-[clamp(28px,3vw,44px)] text-[clamp(34px,4.6vw,72px)]">
          <MaskReveal show={whoIn} duration={0.8}>
            Who decides?
          </MaskReveal>
        </Display>
        <div className="mt-[clamp(24px,3vw,40px)]">
          <DecisionFlow request={tools[active].fn} />
        </div>
      </div>
    </>
  );
}

function Plate({
  tool,
  index,
  isLast,
  position,
  active,
  show,
  onJump,
}: {
  tool: Tool;
  index: number;
  isLast: boolean;
  position: MotionValue<number>;
  active: boolean;
  show: boolean;
  onJump: () => void;
}) {
  // distance > 0: still to come, waiting below. distance < 0: passed, stacked behind.
  const distance = useTransform(position, (v) => index - v);
  const lift = useTransform(distance, (d) => Math.min(d, 0) * PEEK);
  const drop = useTransform(distance, (d) => `${Math.max(d, 0) * 100}%`);
  const scale = useTransform(distance, (d) => 1 + Math.max(Math.min(d, 0), -4) * SHRINK);
  const nearness = useTransform(distance, (d) => Math.max(0, 1 - Math.abs(d)));
  // Mixed from the theme's variables, not fixed hex values, so the plates follow the page when it goes dark.
  const labelColor = useTransform(nearness, towardInk("--c-grey-300"));
  const fnColor = useTransform(nearness, towardInk("--c-grey-400"));
  const ruleColor = useTransform(nearness, towardInk("--c-grey-250"));
  const indent = useTransform(nearness, [0, 1], [0, 16]);

  const onFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.matches(":focus-visible")) onJump();
  };

  return (
    <motion.li className="absolute inset-x-0 top-[48px] origin-top" style={{ y: lift, scale, zIndex: index + 1 }}>
      <motion.div
        className={`relative h-[var(--plate)] border-t bg-paper ${isLast ? "border-b border-b-grey-200" : ""}`}
        style={{ y: drop, borderTopColor: ruleColor }}
      >
        {/* Lime edge: the current action. Same mark the architecture table uses for the fence. */}
        <motion.span aria-hidden className="absolute bottom-0 left-0 top-0 block w-[3px] origin-top bg-lime" style={{ scaleY: nearness }} />
        <button
          type="button"
          aria-pressed={active}
          onClick={onJump}
          onFocus={onFocus}
          className="flex h-full w-full cursor-pointer items-center text-left outline-offset-[-2px]"
        >
          <span className="flex w-full items-baseline justify-between gap-4">
            <motion.span
              className="block text-[length:var(--fs)] font-light leading-none tracking-[-0.035em]"
              initial={{ clipPath: "inset(-0.1em 100% -0.1em 0%)" }}
              animate={{ clipPath: show ? "inset(-0.1em -2% -0.1em 0%)" : "inset(-0.1em 100% -0.1em 0%)" }}
              transition={{ duration: 0.6, delay: 0.1 + index * 0.07, ease: EASE }}
              style={{ x: indent, color: labelColor }}
            >
              {tool.label}
            </motion.span>

            {/* Tool → identifier signal, fired each time this plate becomes the active one. */}
            <span aria-hidden className="relative h-[5px] min-w-0 flex-1 overflow-hidden">
              <motion.span
                className="absolute inset-0 block"
                initial={false}
                animate={{ x: active ? "0%" : "-101%", opacity: active ? 1 : 0 }}
                transition={
                  active
                    ? { x: { duration: 0.45, delay: 0.1, ease: EASE }, opacity: { duration: 0.1, delay: 0.1 } }
                    : { x: { duration: 0, delay: 0.15 }, opacity: { duration: 0.15 } }
                }
              >
                <span className="absolute inset-x-0 top-[2px] block h-px bg-grey-250" />
                <span className="absolute right-0 top-0 block h-[5px] w-[5px] rounded-[3px] bg-ink" />
              </motion.span>
            </span>

            <motion.span
              className="font-mono text-[13px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: show ? 1 : 0 }}
              transition={{ duration: 0.4, delay: 0.35 + index * 0.07 }}
              style={{ color: fnColor }}
            >
              {tool.fn}
            </motion.span>
          </span>
        </button>
      </motion.div>
    </motion.li>
  );
}

/**
 * Active plate → agent. Three hairlines in the column gap, drawn in order: out
 * of the plate at the level of its identifier (the label's baseline sits 0.352em
 * below the plate's middle), down the gap, into "AI agent". The diagram is the
 * last thing in its column and 100px tall, so its line sits 50px above the bottom.
 */
function Connector({ drawn }: { drawn: boolean }) {
  const line = (delay: number, duration: number) => ({ duration, delay, ease: EASE });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 -left-[64px] w-[64px]">
      <motion.span
        className="absolute left-0 top-[calc(48px+var(--plate)/2+var(--fs)*0.352-3px)] block h-px w-[32px] origin-left bg-grey-250"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: drawn ? 1 : 0 }}
        transition={line(0, 0.2)}
      />
      <motion.span
        className="absolute bottom-[49px] left-[32px] top-[calc(48px+var(--plate)/2+var(--fs)*0.352-3px)] block w-px origin-top bg-grey-250"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: drawn ? 1 : 0 }}
        transition={line(0.18, 0.5)}
      />
      <motion.span
        className="absolute bottom-[49px] left-[32px] block h-px w-[26px] origin-left bg-grey-250"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: drawn ? 1 : 0 }}
        transition={line(0.64, 0.2)}
      />
    </div>
  );
}
