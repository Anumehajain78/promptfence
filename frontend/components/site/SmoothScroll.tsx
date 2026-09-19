"use client";

import Lenis from "lenis";
import { useEffect } from "react";

let instance: Lenis | null = null;

// The running Lenis, or null (reduced motion, touch-only, or not mounted yet).
export function getLenis(): Lenis | null {
  return instance;
}

/**
 * Programmatic scroll that goes through Lenis when it is running. A native
 * `behavior: "smooth"` scroll would fight Lenis for the scroll position.
 */
export function scrollToY(top: number) {
  if (instance) instance.scrollTo(top, { duration: 1.1 });
  else window.scrollTo({ top, behavior: "smooth" });
}

/**
 * Site-wide smooth scrolling. Lenis eases the wheel toward the real scroll
 * position, so sticky sections, IntersectionObservers and Framer's useScroll all
 * keep working: the page is still natively scrolled, never transformed.
 *
 * Tuned quick: a higher lerp and a little extra wheel distance, so it glides
 * without feeling heavy. Touch scrolling stays native. Off entirely for
 * prefers-reduced-motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = () => {
      if (reduce.matches || instance) return;
      instance = new Lenis({
        lerp: 0.115,
        wheelMultiplier: 1.2,
        autoRaf: true,
        // Header section links glide there; scroll-margin-top on each section keeps them clear of the header.
        anchors: true,
        // The Control Room has its own scrolling panels (ledger, agent chat): the wheel scrolls those first.
        allowNestedScroll: true,
      });
    };
    const stop = () => {
      instance?.destroy();
      instance = null;
    };
    const sync = () => (reduce.matches ? stop() : start());
    start();
    reduce.addEventListener("change", sync);
    return () => {
      reduce.removeEventListener("change", sync);
      stop();
    };
  }, []);
  return null;
}
