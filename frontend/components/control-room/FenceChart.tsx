import type { DecisionRecord } from "@/lib/api";
import { inr, seqLabel } from "@/lib/format";
import { isCeilingBlock, rowNumber } from "./decision";

interface Props {
  rows: DecisionRecord[];
  loading: boolean;
  limit: number;
}

// viewBox 600 x 260, stretched to the card. Strokes stay crisp via vector-effect: non-scaling-stroke.
const LEFT = 4;
const WIDTH = 592;
const TOP = 22;
const HEIGHT = 214;
const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * How the session total got where it is: one step per allowed refund, climbing toward the policy limit. The
 * limit is the fence, so it is lime; the step that would have crossed it is red and ends on the line. Axis
 * values are text beside the plot, so nothing has to be read from colour or position alone.
 */
export function FenceChart({ rows, loading, limit }: Props) {
  const refunds = loading
    ? []
    : rows.map((row, i) => ({ row, n: rowNumber(row, i) })).filter(({ row }) => row.action === "refund");
  const slots = Math.max(40, refunds.length);
  const top = limit * 1.1;
  const x = (i: number) => Number((LEFT + (i / slots) * WIDTH).toFixed(1));
  const y = (v: number) => Number((TOP + (1 - Math.min(v, top) / top) * HEIGHT).toFixed(1));

  const blockIndex = refunds.findIndex(({ row }) => isCeilingBlock(row));
  const block = blockIndex >= 0 ? refunds[blockIndex] : null;

  // The ground under the stairs, as one closed shape.
  let area = "";
  if (refunds.length) {
    area = `M${x(0)},${y(0)}V${y(refunds[0].row.session_total_before)}`;
    refunds.forEach(({ row }, i) => {
      const end = isCeilingBlock(row) ? row.session_total_before : row.session_total_after;
      area += `H${x(i + 1)}V${y(end)}`;
    });
    area += `V${y(0)}Z`;
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
      <div aria-hidden className="relative h-[clamp(170px,17vw,250px)] w-[78px] font-mono text-[14px] tabular-nums text-grey-700">
        {TICKS.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${(y(limit * t) / 260) * 100}%` }}>
            {inr(Math.round(limit * t))}
          </span>
        ))}
      </div>

      <div className="min-w-0">
        <svg
          viewBox="0 0 600 260"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Session total climbs one step per allowed refund${block ? `; request ${seqLabel(block.n)} stops at the policy limit` : ""}`}
          className="block h-[clamp(170px,17vw,250px)] w-full overflow-visible"
        >
          {TICKS.slice(0, -1).map((t) => (
            <line key={t} x1={LEFT} y1={y(limit * t)} x2={LEFT + WIDTH} y2={y(limit * t)} className="stroke-grey-200" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {area && <path d={area} className="fill-lime/[0.09]" />}
          {refunds.map(({ row, n }, i) => {
            const denied = isCeilingBlock(row);
            const endY = denied ? y(limit) : y(row.session_total_after);
            return (
              <path
                key={`${n}-${row.ts}`}
                d={`M${x(i)},${y(row.session_total_before)}H${x(i + 1)}V${endY}`}
                pathLength={1}
                fill="none"
                className={denied ? "stroke-deny-fill" : "stroke-ink"}
                strokeWidth={denied ? 2.5 : 1.75}
                strokeDasharray={1}
                vectorEffect="non-scaling-stroke"
                style={{ animation: `pf-draw ${denied ? 400 : 200}ms linear both` }}
              />
            );
          })}
          {/* The policy limit is the fence: lime and dashed, drawn over the stairs. */}
          <line x1={LEFT} y1={y(limit)} x2={LEFT + WIDTH} y2={y(limit)} className="stroke-lime" strokeWidth={2} strokeDasharray="7 6" vectorEffect="non-scaling-stroke" />
        </svg>

        <div aria-hidden className="relative mt-2 h-[22px] font-mono text-[14px] tabular-nums text-grey-700">
          <span className="absolute left-0">#01</span>
          <span className="absolute left-1/2 -translate-x-1/2">{seqLabel(Math.round(slots / 2))}</span>
          <span className="absolute right-0">{seqLabel(slots)}</span>
        </div>
      </div>
    </div>
  );
}
