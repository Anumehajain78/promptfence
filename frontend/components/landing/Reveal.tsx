"use client";

import type { ReactNode } from "react";
import { useInViewOnce } from "./useInView";

// Fades and rises into view once: opacity 0→1, translateY 16px→0, 400ms.
// prefers-reduced-motion: the global CSS rule collapses the transition to ~0.
export function Reveal({ children, className = "", delayMs = 0 }: { children: ReactNode; className?: string; delayMs?: number }) {
  const [ref, inView] = useInViewOnce<HTMLDivElement>({ threshold: 0.15 });
  return (
    <div
      ref={ref}
      style={{ transitionDelay: inView && delayMs ? `${delayMs}ms` : undefined }}
      className={`transition-[opacity,transform] duration-[400ms] ease-out ${
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
