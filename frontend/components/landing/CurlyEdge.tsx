"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { usePrefersReducedMotion } from "./motion";

/**
 * The scalloped bottom edge of the light page. It hangs below the page "curtain"
 * (see app/page.tsx) and overlaps the black closing section, which sits still
 * behind the page and is uncovered as this edge lifts.
 *
 * The scallops slide sideways by two lobes as the edge travels up the screen, so
 * the line feels alive rather than printed on. It is one transform on a strip
 * that is a few lobes wider than the screen; the scallop itself is a tiled
 * background (.pf-curly-edge in globals.css). Whole pixels only, so the tile
 * seams never show.
 */
export function CurlyEdge() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start start"] });
  const x = useTransform(scrollYProgress, (v) => (reduced ? 0 : -Math.round(v * 240)));
  return (
    // 1px up, so there is never a hairline between the page and its edge.
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-x-0 top-[calc(100%-1px)] overflow-x-clip">
      <motion.div className="pf-curly-edge" style={{ x }} />
    </div>
  );
}
