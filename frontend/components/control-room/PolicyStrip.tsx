"use client";

import { useState } from "react";
import { POLICIES } from "@/lib/policies";
import { DECISION_TEXT_CLASS, DECISION_WORD } from "./decision";

export function PolicyStrip() {
  const [active, setActive] = useState<number | null>(null);
  const policy = active === null ? null : POLICIES[active];

  return (
    <div onMouseLeave={() => setActive(null)} className="border-b border-grey-200">
      <div role="list" aria-label="Active policies" className="flex flex-wrap">
        {POLICIES.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="listitem"
            aria-expanded={active === i}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className={`flex h-10 cursor-default items-center gap-1.5 whitespace-nowrap border-r border-grey-200 px-3 text-[13px] text-grey-700 transition-colors duration-150 ${
              active === i ? "bg-tint" : "bg-transparent"
            }`}
          >
            {p.label.map((seg) => (
              <span key={seg.text} className={seg.font === "mono" ? "font-mono text-xs" : ""}>
                {seg.text}
              </span>
            ))}
            <span className="text-grey-400">→</span>
            <span className={`font-medium ${DECISION_TEXT_CLASS[p.effect]}`}>{DECISION_WORD[p.effect]}</span>
          </button>
        ))}
      </div>
      {policy && (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 border-t border-grey-100 px-3 pb-4 pt-3 text-[13px]">
          <span className="pt-0.5 font-mono text-xs text-grey-500">{policy.id}</span>
          <pre className="m-0 whitespace-pre-wrap font-mono text-xs leading-relaxed text-grey-700">{policy.cedar.trimEnd()}</pre>
        </div>
      )}
    </div>
  );
}
