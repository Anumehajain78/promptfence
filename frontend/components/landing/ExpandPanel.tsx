"use client";

import { useEffect, useRef, type ReactNode } from "react";

// How small the panel is when its top edge first enters the viewport, and how
// much scrolling (in viewport heights) it takes to reach full bleed.
const START_SCALE_WIDE = 0.6;
const START_SCALE_NARROW = 0.84; // phones: less room to grow into
const TRAVEL = 0.7;

/**
 * Opens its child out as it scrolls into view: it enters as a small card and
 * grows to its full size by the time it sits in the middle of the screen.
 *
 * Scroll-linked, so it is a transform written in a rAF from the scroll position
 * (compositor only, no layout). The outer box is never transformed and is what
 * gets measured, so the panel's own scale cannot feed back into its progress.
 * Without JS, or with prefers-reduced-motion, the child is simply full size.
 */
export function ExpandPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = outer.current;
    const panel = inner.current;
    if (!box || !panel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const top = box.getBoundingClientRect().top;
      const progress = Math.min(1, Math.max(0, (vh - top) / (vh * TRAVEL)));
      // Smoothstep: holds the small card as it enters, then opens out and settles.
      const eased = progress * progress * (3 - 2 * progress);
      const start = window.innerWidth < 768 ? START_SCALE_NARROW : START_SCALE_WIDE;
      panel.style.transform = progress >= 1 ? "" : `scale(${start + (1 - start) * eased})`;
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    panel.style.willChange = "transform";
    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      if (frame) cancelAnimationFrame(frame);
      panel.style.transform = "";
      panel.style.willChange = "";
    };
  }, []);

  return (
    <div ref={outer} className={className}>
      <div ref={inner} className="origin-top">
        {children}
      </div>
    </div>
  );
}
