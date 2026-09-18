"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// One registration point. Importing this module registers the plugin once.
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

// Every landing animation is skipped when the viewer asks for less motion:
// the markup is already in its final state, so nothing needs undoing.
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Pins are desktop-only; below this width sections fall back to reveal-on-enter.
export const PIN_MIN_WIDTH = 768;
