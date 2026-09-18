"use client";

import { useEffect, useState } from "react";
import type { Decision } from "@/lib/api";
import { inr } from "@/lib/format";
import { useInViewOnce } from "./useInView";
import { useReducedMotion } from "@/components/control-room/useReducedMotion";

interface Line {
  n: number;
  time: string;
  agent: string;
  action: string;
  amount: number | null;
  decision: Decision;
  policy: string;
}

const VISIBLE = 10;
const INTERVAL_MS = 900;
const START_MS = 14 * 3_600_000 + 2 * 60_000 + 31_114; // 14:02:31.114
const REFUND_AMOUNTS = [9000, 4500, 7200, 2800, 9000, 6100];
const DENIALS: Omit<Line, "n" | "time">[] = [
  { agent: "support-agent", action: "refund", amount: 9000, decision: "DENY", policy: "cumulative-refund-ceiling-v1" },
  { agent: "intern-agent", action: "export_customer_data", amount: null, decision: "DENY", policy: "forbid-intern-export" },
  { agent: "support-agent", action: "delete_customer", amount: null, decision: "DENY", policy: "forbid-support-delete" },
];

// Deterministic, so the server render and first client render match (no hydration flicker).
function lineAt(k: number): Line {
  const ms = START_MS + k * 740 + ((k * 37) % 200);
  const pad = (v: number, w = 2) => String(v).padStart(w, "0");
  const time = `${pad(Math.floor(ms / 3_600_000) % 24)}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
  const n = 400 + k;
  if (k % 15 === 14) return { n, time, ...DENIALS[Math.floor(k / 15) % DENIALS.length] };
  if (k % 9 === 4) {
    return { n, time, agent: "support-agent", action: "refund", amount: 42000, decision: "APPROVAL", policy: "hold-support-refund-large" };
  }
  if (k % 11 === 7) {
    return { n, time, agent: "finance-agent", action: "refund", amount: 80000, decision: "ALLOW", policy: "allow-finance-refund" };
  }
  return {
    n,
    time,
    agent: "support-agent",
    action: "refund",
    amount: REFUND_AMOUNTS[k % REFUND_AMOUNTS.length],
    decision: "ALLOW",
    policy: "allow-support-refund-small",
  };
}

const WORD: Record<Decision, string> = { ALLOW: "Allow", APPROVAL: "Approval", DENY: "Deny" };
// Fill tones read on the ink surface; the text tones are for paper.
const TONE: Record<Decision, string> = { ALLOW: "text-allow-fill", APPROVAL: "text-amber-fill", DENY: "text-deny-fill" };

export function DecisionStream({ running = true }: { running?: boolean }) {
  const reducedMotion = useReducedMotion();
  const [ref, inView] = useInViewOnce<HTMLDivElement>({ threshold: 0 });
  const [head, setHead] = useState(VISIBLE); // index of the next line to reveal
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (reducedMotion || !inView || !visible || !running) return;
    const t = setInterval(() => setHead((h) => h + 1), INTERVAL_MS);
    return () => clearInterval(t);
  }, [reducedMotion, inView, visible, running]);

  const lines = Array.from({ length: VISIBLE }, (_, i) => lineAt(head - VISIBLE + i));

  return (
    <div
      ref={ref}
      role="log"
      aria-label="Live decision stream (demo data)"
      aria-live="off"
      className="mt-[clamp(48px,6vw,88px)] rounded bg-ink px-[clamp(14px,2vw,24px)] py-4 text-paper"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-grey-700 pb-3 text-[13px] text-grey-300">
        <span>Decision stream</span>
        <span className="font-mono text-xs">demo data</span>
      </div>
      {/* Fixed row count and row height: the panel never changes size. */}
      <ol className="m-0 list-none p-0 font-mono text-[13px] tabular-nums">
        {lines.map((line, i) => (
          <li
            key={line.n}
            className={`grid h-[30px] grid-cols-[52px_minmax(0,1fr)_76px_72px] items-center gap-3 border-b border-grey-700/60 last:border-b-0 sm:grid-cols-[52px_104px_120px_minmax(0,1fr)_84px_76px] ${
              i === VISIBLE - 1 && !reducedMotion ? "animate-pf-row" : ""
            }`}
          >
            <span className="text-grey-400">#{line.n}</span>
            <span className="hidden text-grey-400 sm:block">{line.time}</span>
            <span className="hidden truncate text-grey-250 sm:block">{line.agent}</span>
            <span className="truncate">{line.action}()</span>
            <span className="text-right text-grey-250">{line.amount ? inr(line.amount) : "—"}</span>
            <span className={`text-right font-sans text-sm font-medium ${TONE[line.decision]}`}>{WORD[line.decision]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
