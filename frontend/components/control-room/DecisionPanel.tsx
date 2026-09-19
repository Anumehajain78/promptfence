import type { DecisionRecord } from "@/lib/api";
import { inr, monoSegments, seqLabel } from "@/lib/format";
import { DEFAULT_DENY_CEDAR, policyById } from "@/lib/policies";
import { CloseIcon } from "./icons";
import { CARD, DecisionBadge } from "./ui";

interface Props {
  row: DecisionRecord | null;
  number: number | null;
  // Set when a request was chosen by hand; the close button then returns to the latest one.
  onClose?: () => void;
  className?: string;
}

const EDGE: Record<DecisionRecord["decision"], string> = {
  ALLOW: "before:bg-allow-fill",
  APPROVAL: "before:bg-amber-fill",
  DENY: "before:bg-deny-fill",
};

/**
 * The decision for one request, in the order the questions get asked: what was decided and whether the real
 * tool ran, why, the facts, then the Cedar policy that decided it. The card's left edge takes the decision's
 * colour. It is as tall as its content and never scrolls inside itself.
 */
export function DecisionPanel({ row, number, onClose, className = "" }: Props) {
  const policy = row ? policyById(row.policy) : undefined;

  const pairs: { k: string; v: string }[] = [
    { k: "Agent", v: row?.agent ?? "—" },
    { k: "Action", v: row ? `${row.action}()` : "—" },
    { k: "Resource", v: row?.resource || "—" },
    { k: "Amount", v: row?.amount ? inr(row.amount) : "—" },
    { k: "Session total before", v: row ? inr(row.session_total_before) : "—" },
    { k: "Policy", v: row?.policy ?? "—" },
  ];

  const cedar = row ? (policy ? policy.cedar.trimEnd() : DEFAULT_DENY_CEDAR) : null;
  const lines = cedar?.split("\n") ?? [];
  const hot = (line: string) => !!policy && policy.highlight.some((h) => line.includes(h));

  const tool = !row
    ? { text: "idle", className: "text-grey-700" }
    : row.decision === "DENY"
      ? { text: "not called", className: "text-deny" }
      : row.decision === "APPROVAL"
        ? { text: "waiting for human", className: "text-amber" }
        : { text: "called", className: "text-allow" };

  return (
    <section
      aria-label="Decision"
      className={`${CARD} pf-rise relative overflow-hidden p-[clamp(18px,2vw,30px)] [animation-delay:220ms] before:absolute before:inset-y-0 before:left-0 before:w-1 before:transition-colors before:duration-300 ${
        row ? EDGE[row.decision] : "before:bg-grey-200"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="m-0 text-[clamp(22px,1.8vw,28px)] font-semibold leading-tight tracking-[-0.025em]">
          Decision {number !== null && <span className="font-mono">{seqLabel(number)}</span>}
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to the latest decision"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-[10px] text-grey-700 transition-colors duration-150 hover:bg-tint hover:text-ink"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Keyed by request: a new decision replays the short entrance, so it never just jumps. */}
      <div key={number ?? "none"} className="animate-pf-row">
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {row ? <DecisionBadge decision={row.decision} size="lg" /> : <span className="text-[17px] text-grey-700">No decision yet.</span>}
          <span className={`text-[15px] font-medium ${tool.className}`}>
            Real tool {row && <span className="font-mono">{row.action}()</span>} — {tool.text}
          </span>
        </div>

        {row && (
          <p className="m-0 mt-4 text-[17px] leading-[1.5] text-grey-700 [text-wrap:pretty]">
            {row.reason
              ? monoSegments(row.reason).map((seg, i) =>
                  seg.mono ? (
                    <span key={i} className="font-mono text-[15px] text-ink">
                      {seg.text}
                    </span>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )
              : "No reason recorded."}
          </p>
        )}

        <dl className="m-0 mt-5 border-t border-grey-200">
          {pairs.map((p) => (
            <div key={p.k} className="flex items-baseline justify-between gap-5 border-b border-grey-200 py-3">
              <dt className="text-[16px] text-grey-700">{p.k}</dt>
              <dd className="m-0 min-w-0 text-right font-mono text-[15px] tabular-nums text-ink [overflow-wrap:anywhere]">{p.v}</dd>
            </div>
          ))}
        </dl>

        <pre
          aria-label="Cedar policy"
          className="pf-theme-lock m-0 mt-5 whitespace-pre-wrap rounded-[14px] bg-ink px-5 py-4 font-mono text-[14px] leading-[1.7] text-paper [overflow-wrap:anywhere]"
        >
          {cedar === null ? (
            <span className="block text-grey-300">{"// Select a request to inspect its policy."}</span>
          ) : (
            lines.map((line, i) => (
              <span key={i} className={`-mx-5 block px-5 ${hot(line) ? "bg-lime text-ink" : ""}`}>
                {line || " "}
              </span>
            ))
          )}
        </pre>
      </div>
    </section>
  );
}
