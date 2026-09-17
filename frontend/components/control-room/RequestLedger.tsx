"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { DecisionRecord } from "@/lib/api";
import { clockTime, inr, seqLabel } from "@/lib/format";
import { DECISION_TEXT_CLASS, DECISION_WORD, rowNumber } from "./decision";

interface Props {
  rows: DecisionRecord[];
  loading: boolean;
  selected: number | null;
  onSelect: (n: number) => void;
}

// Column sets from the design. The narrow set hides Time and Resource; it is
// chosen by the ledger's own width, since the ledger is 62% of the page on desktop.
const WIDE_COLS = "grid-cols-[48px_104px_minmax(0,1fr)_92px_92px_104px_84px]";
const NARROW_COLS = "grid-cols-[40px_minmax(0,1fr)_84px_96px_76px]";
const WIDE_MIN_PX = 720;

export function RequestLedger({ rows, loading, selected, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= WIDE_MIN_PX));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const COLS = wide ? WIDE_COLS : NARROW_COLS;
  const WIDE_ONLY = wide ? "block" : "hidden";

  // Newest at the bottom; keep it in view as rows arrive.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  const onKey = (e: KeyboardEvent, n: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(n);
    }
  };

  return (
    <>
      <div className="flex items-baseline justify-between gap-3 pb-2.5 pt-[18px]">
        <h2 className="m-0 text-[17px] font-medium leading-tight">Requests</h2>
        <span className="text-[13px] tabular-nums text-grey-500">{rows.length ? `${rows.length} rows` : ""}</span>
      </div>

      <div
        ref={scroller}
        className="relative max-h-[480px] min-h-0 overflow-y-auto border-t border-grey-200 lg:max-h-none"
      >
        <div
          className={`sticky top-0 z-[1] grid h-9 items-center gap-3 border-b border-grey-200 bg-tint px-2.5 text-[13px] text-grey-500 ${COLS}`}
        >
          <span>#</span>
          <span className={WIDE_ONLY}>Time</span>
          <span>Action</span>
          <span className={WIDE_ONLY}>Resource</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Session</span>
          <span className="text-right">Decision</span>
        </div>

        {loading && (
          <div aria-label="Loading requests">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={`grid h-11 items-center gap-3 border-b border-grey-100 px-2.5 ${COLS}`}>
                <span className="h-2.5 bg-tint" />
                <span className={`h-2.5 bg-tint ${WIDE_ONLY}`} />
                <span className="h-2.5 w-3/5 bg-tint" />
                <span className={`h-2.5 bg-tint ${WIDE_ONLY}`} />
                <span className="h-2.5 bg-tint" />
                <span className="h-2.5 bg-tint" />
                <span className="h-2.5 bg-tint" />
              </div>
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="px-4 py-16 text-center text-grey-500">No requests yet. Send one, or run the attack simulation.</div>
        )}

        {rows.map((row, i) => {
          const n = rowNumber(row, i);
          const on = selected === n;
          const deny = row.decision === "DENY";
          const tone = deny ? "bg-deny-fill/[0.08]" : i % 2 ? "bg-tint-alt" : "bg-transparent";
          return (
            <div
              key={`${n}-${row.ts}`}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              onClick={() => onSelect(n)}
              onKeyDown={(e) => onKey(e, n)}
              className={`relative animate-pf-row cursor-pointer border-b border-grey-100 outline-offset-[-2px] transition-colors duration-100 hover:bg-tint-hover ${tone}`}
            >
              {on && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-ink" />}
              <div className={`grid h-11 items-center gap-3 px-2.5 font-mono text-[13px] tabular-nums ${COLS}`}>
                <span className="text-grey-500">{seqLabel(n)}</span>
                <span className={`text-grey-500 ${WIDE_ONLY}`}>{row.ts ? clockTime(row.ts) : "—"}</span>
                <span className="truncate">{row.action}()</span>
                <span className={`truncate text-grey-500 ${WIDE_ONLY}`}>{row.resource}</span>
                <span className="text-right">{row.amount ? inr(row.amount) : "—"}</span>
                <span className="text-right text-grey-700">{inr(row.session_total_after)}</span>
                <span className={`text-right font-sans text-sm font-medium ${DECISION_TEXT_CLASS[row.decision]}`}>
                  {DECISION_WORD[row.decision]}
                </span>
              </div>
              {deny && row.reason && (
                <div className="pb-3 pl-[58px] pr-2.5 text-[13px] leading-normal text-deny">{row.reason}</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
