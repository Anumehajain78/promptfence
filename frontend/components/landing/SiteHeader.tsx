import Link from "next/link";
import { DASHBOARD, PAGE_X } from "./ui";

export function SiteHeader() {
  return (
    <header className={`sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-grey-200 bg-paper py-3.5 ${PAGE_X}`}>
      <a href="#top" aria-label="PromptFence home" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em] text-ink no-underline">
        <span aria-hidden className="block h-[18px] w-0.5 bg-ink" />
        PromptFence
      </a>
      <nav aria-label="Primary" className="flex items-center gap-[clamp(14px,2vw,26px)] text-sm">
        <a href="#system" className="hidden text-grey-500 no-underline hover:text-ink sm:inline">
          System
        </a>
        <a href="#sequence" className="hidden text-grey-500 no-underline hover:text-ink sm:inline">
          Sequence
        </a>
        <Link
          href={DASHBOARD}
          className="whitespace-nowrap rounded border border-ink px-3.5 py-2 text-ink no-underline transition-colors duration-150 hover:bg-ink hover:text-paper"
        >
          Control Room →
        </Link>
      </nav>
    </header>
  );
}
