"use client";

import { motion } from "framer-motion";
import { EASE, usePrefersReducedMotion } from "./motion";
import type { Tool } from "./ToolList";

/**
 * What the selected action really is: its identifier, and what happens in the
 * world if the call lands. Fixed height, so swapping actions never moves the
 * copy below; the swap is a short horizontal fade-in with no vertical travel.
 *
 * Keyed and enter-only on purpose. A fast scroll passes through several actions
 * in well under a second, and an exit-then-enter presence can be left showing a
 * stale action; a keyed element always shows the current one.
 */
export function Readout({ tool }: { tool: Tool | null }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="mb-[clamp(20px,2.4vw,32px)] min-h-[58px]" aria-live="polite">
      {tool && (
        <motion.div
          key={tool.fn}
          initial={{ opacity: 0, x: 10, clipPath: "inset(0% 12% 0% 0%)" }}
          animate={{ opacity: 1, x: 0, clipPath: "inset(0% -2% 0% 0%)" }}
          transition={reduced ? { duration: 0 } : { duration: 0.35, ease: EASE }}
        >
          <div className="flex items-baseline gap-3 text-[13px]">
            <span className="font-mono text-ink">{tool.fn}</span>
            <span className="text-grey-500">Real tool call</span>
          </div>
          <p className="m-0 mt-1.5 text-[clamp(18px,1.5vw,23px)] font-medium leading-tight tracking-[-0.02em]">{tool.consequence}</p>
        </motion.div>
      )}
    </div>
  );
}
