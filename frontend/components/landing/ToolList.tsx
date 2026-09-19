"use client";

import { motion } from "framer-motion";
import { EASE, usePrefersReducedMotion } from "./motion";

export interface Tool {
  label: string;
  fn: string;
  consequence: string;
}

const STAGGER = 0.07;

/**
 * The five tools as live system elements. Hover, focus or tap selects a row; the
 * selected row sends a small signal from the tool name to its identifier, which
 * is the point of the section: this is a real tool call, not a word.
 */
export function ToolList({
  tools,
  show,
  active,
  onSelect,
}: {
  tools: Tool[];
  show: boolean;
  active: number | null;
  onSelect: (index: number) => void;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="relative">
      {/* Top rule draws first, then the rows come online one by one. */}
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-0 block h-px origin-left bg-ink"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: show ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.7, ease: EASE }}
      />
      <ul className="m-0 list-none p-0">
        {tools.map((tool, i) => (
          <ToolRow
            key={tool.fn}
            tool={tool}
            show={show}
            delay={0.15 + i * STAGGER}
            active={active === i}
            reduced={reduced}
            onSelect={() => onSelect(i)}
          />
        ))}
      </ul>
    </div>
  );
}

function ToolRow({
  tool,
  show,
  delay,
  active,
  reduced,
  onSelect,
}: {
  tool: Tool;
  show: boolean;
  delay: number;
  active: boolean;
  reduced: boolean;
  onSelect: () => void;
}) {
  const enter = (extra = 0, duration = 0.6) => (reduced ? { duration: 0 } : { duration, delay: delay + extra, ease: EASE });
  return (
    <li className="relative">
      <button
        type="button"
        aria-pressed={active}
        onMouseEnter={onSelect}
        onFocus={onSelect}
        onClick={onSelect}
        className="flex w-full cursor-pointer items-baseline justify-between gap-4 py-4 text-left outline-offset-[-2px]"
      >
        {/* Clip reveal on entry; a 3px nudge when selected. */}
        <motion.span
          className="block text-[clamp(36px,6vw,96px)] font-light leading-none tracking-[-0.035em]"
          initial={{ clipPath: "inset(-0.1em 100% -0.1em 0%)" }}
          animate={{ clipPath: show ? "inset(-0.1em -2% -0.1em 0%)" : "inset(-0.1em 100% -0.1em 0%)" }}
          transition={enter()}
        >
          <motion.span className="block" animate={{ x: active ? 3 : 0 }} transition={reduced ? { duration: 0 } : { duration: 0.3, ease: EASE }}>
            {tool.label}
          </motion.span>
        </motion.span>

        {/* Tool → identifier: a hairline with a dot at its head runs to the identifier. */}
        <span aria-hidden className="relative h-[5px] min-w-0 flex-1 overflow-hidden">
          <motion.span
            className="absolute inset-0 block"
            initial={false}
            animate={{ x: active ? "0%" : "-101%", opacity: active ? 1 : 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : active
                  ? { x: { duration: 0.4, ease: EASE }, opacity: { duration: 0.1 } }
                  : { x: { duration: 0, delay: 0.15 }, opacity: { duration: 0.15 } }
            }
          >
            <span className="absolute inset-x-0 top-[2px] block h-px bg-grey-250" />
            <span className="absolute right-0 top-0 block h-[5px] w-[5px] rounded-[3px] bg-ink" />
          </motion.span>
        </span>

        <motion.span
          className={`font-mono text-[13px] transition-colors duration-[250ms] ${active ? "text-ink" : "text-grey-500"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: show ? 1 : 0 }}
          transition={enter(0.25, 0.4)}
        >
          {tool.fn}
        </motion.span>
      </button>

      {/* Row rule, drawn left to right on entry. */}
      <motion.span
        aria-hidden
        className="absolute inset-x-0 bottom-0 block h-px origin-left bg-grey-200"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: show ? 1 : 0 }}
        transition={enter(0.05, 0.7)}
      />
      {/* 1px scan along the rule each time the row is selected. Mounted only while active, so it plays once. */}
      {active && !reduced && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 block h-px overflow-hidden">
          <motion.span
            className="block h-px w-1/4 bg-ink"
            initial={{ x: "-100%" }}
            animate={{ x: "400%" }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          />
        </span>
      )}
    </li>
  );
}
