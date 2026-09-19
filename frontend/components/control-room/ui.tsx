import type { ReactNode } from "react";
import type { Decision } from "@/lib/api";
import { DECISION_WORD } from "./decision";

// The room's surface: a white card lifted a little off the paper. One definition, used everywhere, so
// every card has the same edge, radius and shadow.
export const CARD =
  "rounded-[18px] border border-grey-200 bg-white shadow-[0_1px_2px_rgba(20,20,19,0.04),0_12px_32px_-16px_rgba(20,20,19,0.14)]";

// Small capital label that names a card, as in the design.
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`m-0 text-[14px] font-semibold uppercase tracking-[0.08em] text-ink ${className}`}>{children}</p>;
}

const BADGE: Record<Decision, string> = {
  ALLOW: "bg-allow-fill/[0.14] text-allow",
  APPROVAL: "bg-amber-fill/[0.2] text-amber",
  DENY: "bg-deny-fill/[0.14] text-deny",
};
const DOT: Record<Decision, string> = { ALLOW: "bg-allow-fill", APPROVAL: "bg-amber-fill", DENY: "bg-deny-fill" };

// A decision as a badge. The word carries the meaning; the colour and dot only reinforce it.
export function DecisionBadge({ decision, size = "md" }: { decision: Decision; size?: "md" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[8px] font-medium ${BADGE[decision]} ${
        size === "lg" ? "px-3.5 py-1.5 text-[17px]" : "px-2.5 py-1 text-[14px]"
      }`}
    >
      <span aria-hidden className={`block rounded-[999px] ${DOT[decision]} ${size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5"}`} />
      {DECISION_WORD[decision]}
    </span>
  );
}

export function DecisionDot({ decision }: { decision: Decision }) {
  return <span aria-hidden className={`block h-2.5 w-2.5 shrink-0 rounded-[999px] ${DOT[decision]}`} />;
}
