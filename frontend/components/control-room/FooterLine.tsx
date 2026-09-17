import type { DecisionRecord } from "@/lib/api";

export function FooterLine({ rows, loading }: { rows: DecisionRecord[]; loading: boolean }) {
  const count = (d: DecisionRecord["decision"]) => rows.filter((r) => r.decision === d).length;
  const text =
    loading && rows.length === 0
      ? "Loading session…"
      : `${rows.length} requests · ${count("ALLOW")} allowed · ${count("APPROVAL")} held · ${count("DENY")} denied`;
  return (
    <footer className="border-t border-grey-200 px-[clamp(16px,2.4vw,32px)] py-3 text-sm tabular-nums text-grey-500">{text}</footer>
  );
}
