"use client";

import { motion, useInView, type MotionStyle, type TargetAndTransition } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ALLOW_FILL, DENY_FILL, EASE, LIME, usePrefersReducedMotion } from "./motion";

type Outcome = "allow" | "deny";

const CYCLE = 3.4; // seconds for one request
const REST = 1.5; // seconds between requests

// Shared beats of one request, as fractions of CYCLE.
const AT_FENCE = 0.3;
const VERDICT = 0.6;
const AT_TOOL = 0.9;

// Assembly order on first view (seconds): agent, line, fence, line, tool, then the first request.
const STAGE = { agent: 0, lineIn: 0.2, fence: 0.75, lineOut: 1.1, tool: 1.65, done: 2.1 };

const CLIP_HIDDEN = "inset(-0.2em 100% -0.2em 0%)";
const CLIP_SHOWN = "inset(-0.2em -2% -0.2em 0%)";

/**
 * AI agent ── PromptFence ── Real tool, as a working system.
 *
 * On first view it assembles itself in order. After that a request dot leaves
 * the agent, is held at the fence while it is evaluated, and then either goes on
 * to the real tool (Allow) or stops at the fence (Deny). The two outcomes
 * alternate, and requests only run while the diagram is on screen. `request`
 * names the tool call the agent is asking for, shown under the agent.
 *
 * Every moving part is a transform, opacity, colour or SVG pathLength; each
 * request is one keyed set of keyframes, not a frame loop.
 */
export function DecisionFlow({ armed = true, request }: { armed?: boolean; request?: string }) {
  const root = useRef<HTMLDivElement>(null);
  // `armed` lets a parent hold the assembly until its own story reaches this point.
  const onScreen = useInView(root, { once: true, amount: 0.8 });
  const seen = armed && onScreen;
  const inView = useInView(root, { amount: 0.5 });
  const reduced = usePrefersReducedMotion();

  const [assembled, setAssembled] = useState(false);
  const [run, setRun] = useState(0); // 0 = no request yet; odd = Allow, even = Deny
  const idle = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const inViewRef = useRef(inView);
  inViewRef.current = inView;

  const start = useCallback(() => {
    window.clearTimeout(timer.current);
    idle.current = false;
    setRun((r) => r + 1);
  }, []);

  // The first request follows the assembly.
  useEffect(() => {
    if (!seen || reduced) return;
    const id = window.setTimeout(() => setAssembled(true), STAGE.done * 1000);
    return () => window.clearTimeout(id);
  }, [seen, reduced]);

  useEffect(() => {
    if (assembled && inView && !reduced && idle.current) start();
  }, [assembled, inView, reduced, start]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onRequestDone = () => {
    idle.current = true;
    timer.current = window.setTimeout(() => {
      if (idle.current && inViewRef.current) start();
    }, REST * 1000);
  };

  const outcome: Outcome = run % 2 === 1 ? "allow" : "deny";
  const live = run > 0 && !reduced;
  const stage = (delay: number, duration = 0.45) => (reduced ? { duration: 0 } : { delay, duration, ease: EASE });

  return (
    <div
      ref={root}
      role="img"
      aria-label="A request leaves the AI agent, is evaluated at PromptFence, and reaches the real tool only when the decision is Allow."
      className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center text-[13px] text-grey-500"
    >
      {/* Stage 1: the agent. It reads ink for a moment each time it sends. */}
      <span className="relative col-start-1 row-start-1 pr-3">
        <motion.span
          className="block"
          initial={{ clipPath: CLIP_HIDDEN }}
          animate={{ clipPath: seen ? CLIP_SHOWN : CLIP_HIDDEN }}
          transition={stage(STAGE.agent)}
        >
          <Pulse key={run} live={live} levels={[0, 1, 1, 0, 0]} times={[0, 0.04, 0.24, 0.34, 1]}>
            AI agent
          </Pulse>
        </motion.span>
        {/* The tool call being asked for. Absolutely placed: it never changes the layout. */}
        <span aria-hidden className="absolute left-0 top-full mt-1 block whitespace-nowrap font-mono text-[11px] text-grey-400">
          {/* Keyed, enter-only: always the current request, however fast the actions change. */}
          {request && seen && (
            <motion.span
              key={request}
              className="block"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.3, ease: EASE }}
            >
              {request}
            </motion.span>
          )}
        </span>
      </span>

      {/* Stage 3: the fence. */}
      <div className="col-start-3 row-start-1 flex flex-col items-center gap-2 px-3.5">
        <motion.span
          className="text-ink"
          initial={{ clipPath: CLIP_HIDDEN }}
          animate={{ clipPath: seen ? CLIP_SHOWN : CLIP_HIDDEN }}
          transition={stage(STAGE.fence)}
        >
          PromptFence
        </motion.span>
        <span className="relative block h-[72px] w-0.5">
          <motion.span
            className="block h-full w-full origin-top"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: seen ? 1 : 0 }}
            transition={stage(STAGE.fence, 0.5)}
          >
            {/* The boundary thickens while it holds a request, and reads red on Deny. */}
            <motion.span
              key={run}
              className="block h-full w-full bg-lime outline outline-1 outline-ink"
              initial={false}
              animate={
                live
                  ? {
                      scaleX: [1, 1, 2.5, 2.5, 1, 1],
                      backgroundColor: outcome === "deny" ? [LIME, LIME, DENY_FILL, DENY_FILL, LIME] : LIME,
                    }
                  : { scaleX: 1, backgroundColor: LIME }
              }
              transition={{
                scaleX: { duration: CYCLE, times: [0, AT_FENCE - 0.02, AT_FENCE + 0.04, VERDICT + 0.04, VERDICT + 0.14, 1], ease: "easeInOut" },
                backgroundColor: { duration: CYCLE, times: [0, VERDICT, VERDICT + 0.04, 0.9, 1] },
              }}
            />
          </motion.span>
          {/* Status under the fence. Absolutely placed: it never changes the layout. */}
          <span aria-hidden className="absolute left-1/2 top-full mt-2 block w-0">
            <span className="relative block whitespace-nowrap text-[12px]">
              <Status key={`e${run}`} live={live} times={[0, AT_FENCE - 0.02, AT_FENCE + 0.04, VERDICT - 0.03, VERDICT, 1]} values={[0, 0, 1, 1, 0, 0]}>
                Evaluating
              </Status>
              <Status
                key={`v${run}`}
                live={live}
                times={[0, VERDICT, VERDICT + 0.05, 0.92, 1]}
                values={[0, 0, 1, 1, 0]}
                className={outcome === "allow" ? "text-allow" : "text-deny"}
              >
                {outcome === "allow" ? "Allow" : "Deny · tool not called"}
              </Status>
            </span>
          </span>
        </span>
      </div>

      {/* Stage 5: the real tool. It reads ink only when a request actually arrives. */}
      <motion.span
        className="col-start-5 row-start-1 pl-3"
        initial={{ clipPath: CLIP_HIDDEN }}
        animate={{ clipPath: seen ? CLIP_SHOWN : CLIP_HIDDEN }}
        transition={stage(STAGE.tool)}
      >
        <Pulse
          key={run}
          live={live && outcome === "allow"}
          levels={[0, 0, 1, 1, 0]}
          times={[0, AT_TOOL - 0.03, AT_TOOL, 0.97, 1]}
        >
          Real tool
        </Pulse>
      </motion.span>

      {/* The track: spans from the end of one label to the start of the other, so its centre is the fence. */}
      <div aria-hidden className="pointer-events-none relative col-start-2 col-end-5 row-start-1 h-0 self-center">
        {/* Stages 2 and 4: the two connections draw themselves, agent side first. */}
        <SystemLine side="left" draw={seen} transition={stage(STAGE.lineIn, 0.6)} />
        <SystemLine side="right" draw={seen} transition={stage(STAGE.lineOut, 0.6)} />

        {/* Stage 6: the request. The carrier is as wide as the track and slides under it, so the dot at its
            right end travels the whole way on a single transform. */}
        {live && (
          <motion.div
            key={run}
            className="absolute inset-x-0 top-0"
            initial={{ x: "-100%", opacity: 0 }}
            animate={
              outcome === "allow"
                ? { x: ["-100%", "-50%", "-50%", "0%", "0%"], opacity: [0, 1, 1, 1, 0] }
                : { x: ["-100%", "-50%", "-50%"], opacity: [0, 1, 1, 1, 0] }
            }
            transition={{
              x:
                outcome === "allow"
                  ? { duration: CYCLE, times: [0, AT_FENCE, VERDICT, AT_TOOL, 1], ease: ["easeInOut", "linear", "easeInOut", "linear"] }
                  : { duration: CYCLE, times: [0, AT_FENCE, 1], ease: ["easeInOut", "linear"] },
              opacity: { duration: CYCLE, times: [0, 0.05, VERDICT, outcome === "allow" ? AT_TOOL + 0.03 : 0.88, 1] },
            }}
            onAnimationComplete={onRequestDone}
          >
            {/* The request: theme ink, until the verdict colours it. */}
            <span className="absolute right-0 top-0 -mr-[2.5px] -mt-[2px] block h-[5px] w-[5px] rounded-[3px] bg-ink">
              <motion.span
                className="block h-full w-full rounded-[3px]"
                style={{ backgroundColor: outcome === "allow" ? ALLOW_FILL : DENY_FILL }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1, 1] }}
                transition={{ duration: CYCLE, times: [0, VERDICT, VERDICT + 0.04, 1] }}
              />
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// One connection as SVG, drawn once with pathLength. The 100×1 viewBox stretches to the track, 1px tall.
function SystemLine({ side, draw, transition }: { side: "left" | "right"; draw: boolean; transition: object }) {
  return (
    <svg
      viewBox="0 0 100 1"
      preserveAspectRatio="none"
      className={`absolute top-0 block h-px w-[calc(50%-8px)] ${side === "left" ? "left-0" : "right-0"}`}
    >
      <motion.line
        x1="0"
        y1="0.5"
        x2="100"
        y2="0.5"
        strokeWidth="1"
        style={{ stroke: "var(--c-grey-200)" }}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: draw ? 1 : 0 }}
        transition={transition}
      />
    </svg>
  );
}

// A label that goes from label grey to ink and back on a beat of the request. Keyed by run, so each request
// replays it. The level is a number; the colours it mixes are the theme's, so it is right on light and dark.
function Pulse({ live, levels, times, children }: { live: boolean; levels: number[]; times: number[]; children: string }) {
  return (
    <motion.span
      initial={false}
      animate={{ "--pulse": live ? levels : 0 } as TargetAndTransition}
      transition={{ duration: CYCLE, times }}
      style={{ "--pulse": 0, color: "color-mix(in srgb, var(--c-ink) calc(var(--pulse) * 100%), var(--c-grey-500))" } as MotionStyle}
    >
      {children}
    </motion.span>
  );
}

function Status({
  live,
  times,
  values,
  className = "",
  children,
}: {
  live: boolean;
  times: number[];
  values: number[];
  className?: string;
  children: string;
}) {
  return (
    <span className={`absolute left-1/2 top-0 -translate-x-1/2 ${className}`}>
      <motion.span className="block" initial={{ opacity: 0 }} animate={{ opacity: live ? values : 0 }} transition={{ duration: CYCLE, times }}>
        {children}
      </motion.span>
    </span>
  );
}
