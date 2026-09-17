import type { DecisionRecord } from "@/lib/api";
import { inr, seqLabel } from "@/lib/format";
import { isCeilingBlock, rowNumber } from "./decision";

interface Props {
  rows: DecisionRecord[];
  loading: boolean;
  limit: number;
}

// viewBox 600 x 240, stretched to the section width. Strokes stay crisp via
// vector-effect: non-scaling-stroke.
const LEFT = 8;
const WIDTH = 584;
const TOP = 18;
const HEIGHT = 200;

export function FenceChart({ rows, loading, limit }: Props) {
  const refunds = loading
    ? []
    : rows.map((row, i) => ({ row, n: rowNumber(row, i) })).filter(({ row }) => row.action === "refund");
  const slots = Math.max(40, refunds.length);
  const top = limit * 1.12;
  // Rounded once here so the denied step ends exactly on the limit line.
  const x = (i: number) => Number((LEFT + (i / slots) * WIDTH).toFixed(1));
  const y = (v: number) => Number((TOP + (1 - Math.min(v, top) / top) * HEIGHT).toFixed(1));

  const blockIndex = refunds.findIndex(({ row }) => isCeilingBlock(row));
  const block = blockIndex >= 0 ? refunds[blockIndex] : null;

  return (
    <>
      <h2 className="m-0 text-[17px] font-medium leading-tight">Session total vs policy limit</h2>
      <svg
        viewBox="0 0 600 240"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Session total climbs one step per allowed refund${block ? `; request ${seqLabel(block.n)} stops at the policy limit` : ""}`}
        className="mt-3.5 block h-[clamp(150px,18vw,220px)] w-full overflow-visible"
      >
        <line x1={LEFT} y1={y(limit)} x2={LEFT + WIDTH} y2={y(limit)} className="stroke-ink" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {refunds.map(({ row, n }, i) => {
          const denied = isCeilingBlock(row);
          const endY = denied ? y(limit) : y(row.session_total_after);
          return (
            <path
              key={`${n}-${row.ts}`}
              d={`M${x(i)},${y(row.session_total_before)}H${x(i + 1)}V${endY}`}
              pathLength={1}
              fill="none"
              className={denied ? "stroke-deny-fill" : "stroke-grey-400"}
              strokeWidth={denied ? 2 : 1.5}
              strokeDasharray={1}
              vectorEffect="non-scaling-stroke"
              style={{ animation: `pf-draw ${denied ? 400 : 200}ms linear both` }}
            />
          );
        })}
        {block && <rect x={x(blockIndex + 1) - 4} y={y(limit) - 4} width={8} height={8} className="fill-deny-fill" />}
      </svg>
      <div className="relative -mt-1 h-[18px] font-mono text-xs tabular-nums text-grey-500">
        <span className="absolute left-0">#01</span>
        <span className="absolute left-1/2 -translate-x-1/2">{seqLabel(Math.round(slots / 2))}</span>
        <span className="absolute right-0">{seqLabel(slots)}</span>
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-[13px]">
        <span className="text-grey-700">
          Policy limit <span className="font-mono text-ink">{inr(limit)}</span>
        </span>
        <span className={`text-deny transition-opacity duration-300 ${block ? "opacity-100" : "opacity-0"}`} aria-hidden={!block}>
          <span className="font-mono">{block ? seqLabel(block.n) : "#40"}</span> · stopped
        </span>
      </div>
    </>
  );
}
