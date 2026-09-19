"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE, usePrefersReducedMotion } from "./motion";

// The sections are not numbered on the page; these links are how you jump to one.
const SECTIONS = [
  { id: "problem", label: "Problem" },
  { id: "system", label: "System" },
  { id: "sequence", label: "Sequence" },
  { id: "decisions", label: "Decisions" },
  { id: "aws", label: "Architecture" },
];

export function SectionNav({ className = "" }: { className?: string }) {
  const [active, setActive] = useState("");
  const reduced = usePrefersReducedMotion();

  // The active link is the section crossing the middle of the viewport.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
          else setActive((current) => (current === entry.target.id ? "" : current));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    // layoutScroll: on phones this nav scrolls sideways, and the indicator must measure inside it.
    <motion.nav
      layoutScroll
      aria-label="Sections"
      className={`flex items-center gap-[clamp(16px,2vw,28px)] overflow-x-auto text-sm [scrollbar-width:none] ${className}`}
    >
      {SECTIONS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? "true" : undefined}
          className={`relative whitespace-nowrap py-1 no-underline transition-colors duration-150 hover:text-ink ${
            active === id ? "text-ink" : "text-grey-500"
          }`}
        >
          {label}
          {/* One shared underline: it travels between links instead of blinking off and on. */}
          {active === id && (
            <motion.span
              layoutId="section-nav-active"
              aria-hidden
              className="absolute inset-x-0 bottom-0 block h-px bg-ink"
              transition={reduced ? { duration: 0 } : { duration: 0.4, ease: EASE }}
            />
          )}
        </a>
      ))}
    </motion.nav>
  );
}
