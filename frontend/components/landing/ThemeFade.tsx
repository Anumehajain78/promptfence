"use client";

import { useEffect } from "react";

// The section that takes the page dark, and the element that carries the theme.
const DARK_SECTION = "system";
const PAGE = "pf-page";

/**
 * Cross-fades the whole landing page from light to dark as the System section
 * arrives, and back as it leaves.
 *
 * The trigger is a line across the middle of the screen: while the section
 * crosses it, the page is dark. The fade itself is CSS (globals.css: the palette
 * variables transition on .pf-theme), so it runs at its own pace in either
 * direction however fast the reader scrolls, and costs nothing per frame.
 */
export function ThemeFade() {
  useEffect(() => {
    const page = document.getElementById(PAGE);
    const section = document.getElementById(DARK_SECTION);
    if (!page || !section || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => page.classList.toggle("pf-theme-dark", entry.isIntersecting),
      { rootMargin: "-50% 0px -50% 0px" },
    );
    observer.observe(section);
    return () => {
      observer.disconnect();
      page.classList.remove("pf-theme-dark");
    };
  }, []);
  return null;
}
