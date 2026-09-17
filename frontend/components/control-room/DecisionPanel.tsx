import type { DecisionRecord } from "@/lib/api";
import { inr, monoSegments, seqLabel } from "@/lib/format";
import { DEFAULT_DENY_CEDAR, policyById } from "@/lib/policies";
import { DECISION_TEXT_CLASS, DECISION_WORD } from "./decision";

interface Props {
  row: DecisionRecord | null;
  number: number | null;
}

export function DecisionPanel({ row, number }: Props) {
  const policy = row ? policyById(row.policy) : undefined;
  const deny = row?.decision === "DENY";

  const pairs: { k: string; v: string; mono: boolean; className?: string }[] = [
    { k: "Agent", v: row?.agent ?? "—", mono: true },
    { k: "Action", v: row ? `${row.action}()` : "—", mono: true },
    { k: "Resource", v: row?.resource || "—", mono: true },
    { k: "Amount", v: row?.amount ? inr(row.amount) : "—", mono: true },
    { k: "Session total before", v: row ? inr(row.session_total_before) : "—", mono: true },
    {
      k: "Decision",
      v: row ? DECISION_WORD[row.decision] : "—",
      mono: false,
      className: row ? `font-medium ${DECISION_TEXT_CLASS[row.decision]}` : "",
    },
    { k: "Policy", v: row?.policy ?? "—", mono: true },
  ];

  const cedar = row ? (policy ? policy.cedar.trimEnd() : DEFAULT_DENY_CEDAR) : null;
  const lines = cedar?.split("\n") ?? [];
  const hot = (line: string) => !!policy && policy.highlight.some((h) => line.includes(h));

  const tool = !row
    ? { text: "idle", className: "text-grey-500" }
    : row.decision === "DENY"
      ? { text: "not called", className: "text-deny" }
      : row.decision === "APPROVAL"
        ? { text: "waiting for human", className: "text-amber" }
        : { text: "called", className: "text-allow" };

  return (
    <section
      aria-label="Decision"
      className={`flex min-h-0 flex-col border-l-2 px-[clamp(16px,2.4vw,32px)] py-[clamp(16px,2vw,28px)] transition-colors duration-200 [grid-area:c] lg:overflow-y-auto ${
        deny ? "border-deny-fill" : "border-transparent"
      }`}
    >
      <h2 className="m-0 text-[17px] font-medium leading-tight">
        Decision {number !== null && <span className="font-mono font-medium">{seqLabel(number)}</span>}
      </h2>

      <dl className="m-0 mt-3.5 shrink-0 border-t border-grey-200 text-sm">
        {pairs.map((p) => (
          <div key={p.k} className="flex justify-between gap-4 border-b border-grey-100 py-2">
            <dt className="text-grey-500">{p.k}</dt>
            <dd className={`m-0 text-right tabular-nums ${p.mono ? "font-mono text-[13px]" : "text-sm"} ${p.className ?? ""}`}>
              {p.v}
            </dd>
          </div>
        ))}
      </dl>

      <pre
        aria-label="Cedar policy"
        className="m-0 mt-4 shrink-0 overflow-x-auto whitespace-pre rounded bg-ink px-4 py-3.5 font-mono text-xs leading-[1.65] text-paper"
      >
        {cedar === null ? (
          <span className="block text-grey-300">{"// Select a request to inspect its policy."}</span>
        ) : (
          lines.map((line, i) => (
            <span key={i} className={`-mx-4 block px-4 ${hot(line) ? "bg-lime text-ink" : ""}`}>
              {line || " "}
            </span>
          ))
        )}
      </pre>

      <p className="m-0 mt-4 shrink-0 text-[15px] leading-normal text-grey-700">
        {row?.reason
          ? monoSegments(row.reason).map((seg, i) =>
              seg.mono ? (
                <span key={i} className="font-mono text-[13px] text-ink">
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )
          : row
            ? "No reason recorded."
            : "No decision yet."}
      </p>

      <div className={`mt-3.5 shrink-0 border-t border-grey-200 pt-3 text-sm ${tool.className}`}>
        Real tool {row && <span className="font-mono text-[13px]">{row.action}()</span>} — {tool.text}
      </div>
    </section>
  );
}
