import Link from "next/link";
import type { ReactNode } from "react";

export const DASHBOARD = "/dashboard/";
export const DASHBOARD_ATTACK = "/dashboard/?attack=1";

export const PAGE_X = "px-[clamp(20px,5vw,80px)]";
// Vertical rhythm between sections. Top and bottom are separate so a section that ends in its own
// whitespace (the pinned problem stage) can close tighter.
export const SECTION_TOP = "pt-[clamp(44px,5.5vw,84px)]";
export const SECTION_BOTTOM = "pb-[clamp(44px,5.5vw,84px)]";
export const SECTION_Y = `${SECTION_TOP} ${SECTION_BOTTOM}`;

// Section label in Geist, sentence case. Sections are not numbered; the header nav links to them.
export function Kicker({ children, aside, onInk = false }: { children: ReactNode; aside?: ReactNode; onInk?: boolean }) {
  return (
    <div className={`flex flex-wrap justify-between gap-4 text-[13px] ${onInk ? "text-grey-400" : "text-grey-500"}`}>
      <span>{children}</span>
      {aside}
    </div>
  );
}

export function Display({ children, className = "", as: Tag = "h2" }: { children: ReactNode; className?: string; as?: "h1" | "h2" | "h3" | "div" }) {
  return (
    <Tag className={`m-0 font-medium leading-[0.95] tracking-[-0.045em] [text-wrap:balance] ${className}`}>{children}</Tag>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center whitespace-nowrap rounded border border-lime bg-lime px-5 text-[15px] font-medium text-ink no-underline transition-colors duration-150 hover:border-lime-hover hover:bg-lime-hover"
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children, onInk = false }: { href: string; children: ReactNode; onInk?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center whitespace-nowrap rounded border px-5 text-[15px] font-medium no-underline transition-colors duration-150 ${
        onInk ? "border-paper text-paper hover:bg-paper hover:text-ink" : "border-ink text-ink hover:bg-ink hover:text-paper"
      }`}
    >
      {children}
    </Link>
  );
}

// The fence mark: a red square, used where the design drew a ✕ (no icons).
export function StopMark({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block h-2 w-2 bg-deny-fill ${className}`} />;
}
