"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE, usePrefersReducedMotion } from "./motion";

// The clip reaches a little past the box so descenders and tight leading are never cut.
const HIDDEN = "inset(-0.15em 100% -0.15em -2%)";
const SHOWN = "inset(-0.15em -2% -0.15em -2%)";

/**
 * Editorial reveal: the text already sits in its final position and a clip
 * wipes across it left to right. Nothing moves.
 */
export function MaskReveal({
  show,
  children,
  delay = 0,
  duration = 0.9,
  className = "",
}: {
  show: boolean;
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.span
      className={`block ${className}`}
      initial={{ clipPath: HIDDEN }}
      animate={{ clipPath: show ? SHOWN : HIDDEN }}
      transition={reduced ? { duration: 0 } : { duration, delay, ease: EASE }}
    >
      {children}
    </motion.span>
  );
}
