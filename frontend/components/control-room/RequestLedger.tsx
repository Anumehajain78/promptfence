"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { DecisionRecord } from "@/lib/api";
import { clockTime, inr, seqLabel } from "@/lib/format";
import { rowNumber } from "./decision";
import { ChevronRightIcon } from "./icons";
import { CARD, DecisionBadge, Eyebrow } from "./ui";

interface Props {
  rows: DecisionRecord[];
  loading: boolean;
  selected: number | null;
  onSelect: (n: number) => void;
}

// Column sets, chosen by the table's own width. Wide shows everything; narrow drops Time and Resource; compact
// (phones) also drops the session total, which the session card already shows.
const WIDE_COLS = "grid-cols-[52px_118px_minmax(0,0.9fr)_minmax(0,1fr)_96px_108px_108px_20px]";
const NARROW_COLS = "grid-cols-[52px_minmax(0,1fr)_100px_116px_108px_20px]";
const COMPACT_COLS = "grid-cols-[46px_minmax(0,1fr)_84px_100px]";
const WIDE_MIN_PX = 780;
const NARROW_MIN_PX = 520;
const RECENT = 8;

/**
 * The ledger. It never scrolls inside itself: it shows the latest few requests, in order, and "Show all"
 * opens the rest in place so the page scrolls, not the card. The selected request is outlined and points at
 * the Decision card beside it.
 */
export function RequestLedger({ rows, loading, selected, onSelect }: Props) {
  const table = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [compact, setCompact] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    const el = table.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWide(entry.contentRect.width >= WIDE_MIN_PX);
      setCompact(entry.contentRect.width < NARROW_MIN_PX);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const COLS = wide ? WIDE_COLS : compact ? COMPACT_COLS : NARROW_COLS;
  const WIDE_ONLY = wide ? "block" : "hidden";
  const NOT_COMPACT = compact ? "hidden" : "block";

  const numbered = rows.map((row, i) => ({ row, n: rowNumber(row, i) }));
  const hidden = all ? 0 : Math.max(0, numbered.length - RECENT);
  const shown = numbered.slice(hidden);
  const count = (d: DecisionRecord["decision"]) => rows.filter((r) => r.decision === d).length;

  const onKey = (e: KeyboardEvent, n: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(n);
    }
  };

  return (
    <section aria-label="Requests" className={`${CARD} pf-rise p-[clamp(18px,2vw,30px)] [animation-delay:160ms]`}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Eyebrow className="!text-[16px]">Requests</Eyebrow>
        <p role="status" aria-atomic="true" className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] tabular-nums text-grey-700">
          {loading && rows.length === 0 ? (
            "Loading session…"
          ) : (
            <>
              <span className="font-medium text-ink">{rows.length} rows</span>
              <span className="text-allow">{count("ALLOW")} allowed</span>
              <span className="text-amber">{count("APPROVAL")} held</span>
              <span className="text-deny">{count("DENY")} denied</span>
            </>
          )}
        </p>
      </div>

      <div ref={table} className="mt-5">
        <div className={`grid h-12 items-center gap-3 rounded-[10px] bg-tint px-4 text-[14px] font-medium uppercase tracking-[0.06em] text-grey-700 ${COLS}`}>
          <span>#</span>
          <span className={WIDE_ONLY}>Time</span>
          <span>Action</span>
          <span className={WIDE_ONLY}>Resource</span>
          <span className="text-right">Amount</span>
          <span className={`text-right ${NOT_COMPACT}`}>Session</span>
          <span className="text-right">Decision</span>
          <span className={NOT_COMPACT} />
        </div>

        {loading && (
          <div aria-label="Loading requests">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`grid h-[60px] items-center gap-3 border-b border-grey-100 px-4 ${COLS}`}>
                <span className="h-3 animate-pf-pulse rounded bg-tint" />
                <span className={`h-3 animate-pf-pulse rounded bg-tint ${WIDE_ONLY}`} />
                <span className="h-3 w-3/5 animate-pf-pulse rounded bg-tint" />
                <span className={`h-3 animate-pf-pulse rounded bg-tint ${WIDE_ONLY}`} />
                <span className="h-3 animate-pf-pulse rounded bg-tint" />
                <span className={`h-3 animate-pf-pulse rounded bg-tint ${NOT_COMPACT}`} />
                <span className="h-3 animate-pf-pulse rounded bg-tint" />
                <span className={NOT_COMPACT} />
              </div>
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="px-4 py-16 text-center text-[17px] text-grey-700">No requests yet. Send one, or run the attack simulation.</div>
        )}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="mt-2 flex h-[48px] w-full cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-grey-250 text-[15px] font-medium text-grey-700 transition-colors duration-150 hover:border-ink hover:text-ink"
          >
            Show all {rows.length} rows
          </button>
        )}

        <div className="mt-1.5 grid gap-1.5">
          {shown.map(({ row, n }) => {
            const on = selected === n;
            const deny = row.decision === "DENY";
            return (
              <div
                key={`${n}-${row.ts}`}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                onClick={() => onSelect(n)}
                onKeyDown={(e) => onKey(e, n)}
                className={`group animate-pf-row cursor-pointer rounded-[12px] border outline-offset-2 transition-[border-color,background-color,box-shadow] duration-200 ${
                  deny ? "bg-deny-fill/[0.08]" : "bg-transparent hover:bg-tint-alt"
                } ${on ? (deny ? "border-deny-fill shadow-[0_0_0_1px_#FF4D4D]" : "border-ink shadow-[0_0_0_1px_var(--c-ink)]") : "border-transparent"}`}
              >
                <div className={`grid h-[58px] items-center gap-3 px-4 font-mono text-[15px] tabular-nums ${COLS}`}>
                  <span className="text-grey-700">{seqLabel(n)}</span>
                  <span className={`text-grey-700 ${WIDE_ONLY}`}>{row.ts ? clockTime(row.ts) : "—"}</span>
                  <span className="truncate text-ink">{row.action}()</span>
                  <span className={`truncate text-grey-700 ${WIDE_ONLY}`}>{row.resource}</span>
                  <span className="text-right font-medium text-ink">{row.amount ? inr(row.amount) : "—"}</span>
                  <span className={`text-right text-grey-700 ${NOT_COMPACT}`}>{inr(row.session_total_after)}</span>
                  <span className="flex justify-end font-sans">
                    <DecisionBadge decision={row.decision} />
                  </span>
                  <ChevronRightIcon
                    className={`${NOT_COMPACT} transition-[opacity,transform] duration-200 ${deny ? "text-deny" : "text-ink"} ${
                      on ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"
                    }`}
                  />
                </div>
                {deny && row.reason && (
                  <div className={`pb-4 pr-4 text-[15px] leading-normal text-deny ${compact ? "pl-4" : "pl-[calc(16px+52px+12px)]"}`}>{row.reason}</div>
                )}
              </div>
            );
          })}
        </div>

        {all && numbered.length > RECENT && (
          <button
            type="button"
            onClick={() => setAll(false)}
            className="mt-2 flex h-[48px] w-full cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-grey-250 text-[15px] font-medium text-grey-700 transition-colors duration-150 hover:border-ink hover:text-ink"
          >
            Show only the latest {RECENT}
          </button>
        )}
      </div>
    </section>
  );
}
