import type { DecisionRecord } from "@/lib/api";
import { inr, seqLabel } from "@/lib/format";
import { FenceChart } from "./FenceChart";
import { SessionTotal } from "./SessionTotal";
import { isCeilingBlock, rowNumber } from "./decision";

interface Props {
  rows: DecisionRecord[];
  loading: boolean;
  total: number;
  limit: number;
  blocked: boolean;
  running: boolean;
  reducedMotion: boolean;
  className?: string;
}

/**
 * The session, on black: the room's one dark object, and so the first thing the eye lands on. The chart of
 * how the total got here, then the total itself as large as the card allows, the limit beside it, and a meter
 * of how much of the limit is used.
 *
 * pf-theme-dark flips the neutral palette for everything inside, the same switch the landing page uses for
 * its black sections, so this is the landing page's black and not a second palette.
 */
export function SessionBand({ rows, loading, total, limit, blocked, running, reducedMotion, className = "" }: Props) {
  const blockIndex = rows.findIndex(isCeilingBlock);
  const blockNumber = blockIndex >= 0 ? rowNumber(rows[blockIndex], blockIndex) : null;
  const used = Math.min(1, total / limit);

  return (
    <section
      aria-label="Session total vs policy limit"
      className={`pf-theme-dark relative overflow-hidden rounded-[22px] bg-paper p-[clamp(20px,2vw,30px)] text-ink shadow-[0_24px_60px_-28px_rgba(0,0,0,0.65)] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-2.5 text-[14px] font-semibold uppercase tracking-[0.08em] text-ink">
          {running && <span aria-hidden className="block h-2 w-2 animate-pf-pulse rounded-[999px] bg-lime" />}
          Session total vs policy limit
        </h2>
        <span
          className={`rounded-[8px] bg-deny-fill/[0.18] px-2.5 py-1 font-mono text-[14px] font-medium text-deny-fill transition-opacity duration-300 ${
            blockNumber !== null ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={blockNumber === null}
        >
          {blockNumber !== null ? seqLabel(blockNumber) : "#40"} · stopped
        </span>
      </div>

      <div className="mt-6">
        <FenceChart rows={rows} loading={loading} limit={limit} />
      </div>

      <div className={`mt-6 rounded-[16px] border p-[clamp(16px,1.6vw,24px)] transition-colors duration-500 ${blocked ? "border-deny-fill/40 bg-deny-fill/[0.1]" : "border-grey-200 bg-grey-100"}`}>
        <div className="grid items-end gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="m-0 text-[14px] font-medium uppercase tracking-[0.08em] text-grey-700">Current session</p>
            <SessionTotal value={total} limit={limit} blocked={blocked} reducedMotion={reducedMotion} />
          </div>
          <div className="sm:text-right">
            <p className="m-0 text-[14px] font-medium uppercase tracking-[0.08em] text-grey-700">Policy limit</p>
            <p className="m-0 mt-2 font-mono text-[clamp(22px,2vw,30px)] font-medium leading-none tabular-nums text-ink">{inr(limit)}</p>
          </div>
        </div>

        {/* How much of the limit is used. The lime tick at the end is the fence. */}
        <div className="relative mt-5 h-2 rounded-[999px] bg-grey-200" role="presentation">
          <div
            className={`h-full origin-left rounded-[999px] transition-transform duration-500 ease-out ${blocked ? "bg-deny-fill" : "bg-ink"}`}
            style={{ transform: `scaleX(${used})` }}
          />
          <span aria-hidden className="absolute -top-1.5 right-0 block h-5 w-[3px] rounded-[999px] bg-lime" />
        </div>
      </div>
    </section>
  );
}
