import Link from "next/link";
import { Logo } from "@/components/site/Logo";
import { SectionNav } from "./SectionNav";
import { DASHBOARD, PAGE_X } from "./ui";

export function SiteHeader() {
  return (
    <header className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-paper py-3.5 ${PAGE_X}`}>
      <a href="#top" aria-label="PromptFence home" className="text-ink no-underline transition-[color,opacity] duration-300 hover:opacity-70">
        <Logo />
      </a>
      {/* One nav: inline from md up, a scrollable second row on phones. */}
      <SectionNav className="order-last w-full md:order-none md:w-auto" />
      <Link
        href={DASHBOARD}
        className="whitespace-nowrap rounded border border-ink px-3.5 py-2 text-sm text-ink no-underline transition-colors duration-150 hover:bg-ink hover:text-paper"
      >
        Control Room →
      </Link>
    </header>
  );
}
