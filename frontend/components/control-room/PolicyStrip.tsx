"use client";

import { useState } from "react";
import { POLICIES } from "@/lib/policies";
import { DecisionBadge, DecisionDot, Eyebrow } from "./ui";

/**
 * The six policy rules as a grid you can read at a glance: a dot and the rule on the left, what Cedar answers
 * on the right. Selecting one opens its Cedar source underneath the grid. The rule that decided the request
 * you are inspecting is outlined in lime, which ties this card to the Decision card.
 */
export function PolicyStrip({ decidedBy }: { decidedBy?: string | null }) {
  const [open, setOpen] = useState<number | null>(null);
  const policy = open === null ? null : POLICIES[open];

  return (
    <div>
      <Eyebrow>Policy rules</Eyebrow>
      <ul aria-label="Active policies" className="m-0 mt-4 grid list-none gap-2.5 p-0 md:grid-cols-2">
        {POLICIES.map((p, i) => {
          const on = open === i;
          const decided = decidedBy === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-expanded={on}
                onClick={() => setOpen(on ? null : i)}
                className={`flex min-h-[54px] w-full cursor-pointer items-center gap-3.5 rounded-[12px] border bg-white px-4 py-2.5 text-left text-[16px] text-ink transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_-12px_rgba(20,20,19,0.4)] ${
                  decided ? "border-lime shadow-[0_0_0_3px_rgba(184,242,39,0.4)]" : on ? "border-ink" : "border-grey-200 hover:border-grey-400"
                }`}
              >
                <DecisionDot decision={p.effect} />
                <span className="min-w-0 flex-1">
                  {p.label.map((seg) => (
                    <span key={seg.text} className={seg.font === "mono" ? "font-mono text-[15px]" : ""}>
                      {seg.text}{" "}
                    </span>
                  ))}
                  {decided && <span className="sr-only">(decided the selected request)</span>}
                </span>
                <DecisionBadge decision={p.effect} />
              </button>
            </li>
          );
        })}
      </ul>
      {policy && (
        <div className="mt-3 animate-pf-row rounded-[12px] bg-tint px-5 py-4">
          <div className="font-mono text-[14px] text-grey-700">{policy.id}</div>
          <pre className="m-0 mt-2 whitespace-pre-wrap font-mono text-[14px] leading-[1.7] text-ink [overflow-wrap:anywhere]">{policy.cedar.trimEnd()}</pre>
        </div>
      )}
    </div>
  );
}
