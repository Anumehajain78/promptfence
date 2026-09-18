import Link from "next/link";
import type { ReactNode } from "react";

export const DASHBOARD = "/dashboard/";
export const DASHBOARD_ATTACK = "/dashboard/?attack=1";

export const PAGE_X = "px-[clamp(20px,5vw,80px)]";
export const SECTION_Y = "py-[clamp(80px,11vw,168px)]";

// Section label: number in mono, label in Geist, sentence case.
export function Kicker({ n, children, aside }: { n: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-4 text-[13px] text-grey-500">
      <span>
        <span className="font-mono">{n}</span> — {children}
      </span>
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

// `inverted` is for the closing section once it has crossfaded to ink.
export function SecondaryLink({ href, children, inverted = false }: { href: string; children: ReactNode; inverted?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center whitespace-nowrap rounded border px-5 text-[15px] font-medium no-underline transition-colors duration-150 ${
        inverted ? "border-paper text-paper hover:bg-paper hover:text-ink" : "border-ink text-ink hover:bg-ink hover:text-paper"
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
