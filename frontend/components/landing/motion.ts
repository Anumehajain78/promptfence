"use client";

import { useEffect, useState } from "react";

// One easing for the whole section: quick to start, long to settle.
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Accent values for colour keyframes (Framer interpolates values, not class names). Neutrals are not here
// on purpose: they are theme variables (globals.css), so use classes or var(--c-*) for them.
export const LIME = "#B8F227";
export const ALLOW_FILL = "#18B981";
export const DENY_FILL = "#FF4D4D";

/**
 * False on the server and on the first client render, then the real preference,
 * so the prerendered HTML always matches hydration. Motion code keeps the same
 * markup either way and only collapses durations to 0.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}
