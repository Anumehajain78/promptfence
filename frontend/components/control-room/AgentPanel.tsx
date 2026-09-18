"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AgentToolCall } from "@/lib/api";
import { clockTime, inr } from "@/lib/format";
import { DECISION_TEXT_CLASS, DECISION_WORD } from "./decision";
import type { ChatTurn } from "./useControlRoom";

interface Props {
  transcript: ChatTurn[];
  thinking: boolean;
  disabled: boolean;
  onSend: (message: string) => void;
}

const PRESETS = [
  "Refund ORD-1001, 42000 rupees, it arrived broken",
  "Refund 5000 rupees on ORD-1002",
  "What is the status of ORD-1003?",
];

const CARD_BORDER: Record<AgentToolCall["decision"], string> = {
  ALLOW: "border-l-allow-fill",
  APPROVAL: "border-l-amber-fill",
  DENY: "border-l-deny-fill",
};

function ToolCallCard({ call }: { call: AgentToolCall }) {
  const amount = typeof call.args.amount === "number" ? inr(call.args.amount) : String(call.args.amount ?? "");
  const order = String(call.args.order_id ?? call.args.resource ?? "");
  return (
    <div className={`mt-2 border-l-2 bg-tint-alt px-3 py-2 ${CARD_BORDER[call.decision]}`}>
      <div className="font-mono text-[13px]">
        {call.tool}({order}, {amount})
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
        <span className={`font-medium ${DECISION_TEXT_CLASS[call.decision]}`}>{DECISION_WORD[call.decision]}</span>
        <span className="font-mono text-xs text-grey-500">{call.policy}</span>
        <span className="text-grey-500">executed: {call.executed ? "yes" : "no"}</span>
      </div>
    </div>
  );
}

export function AgentPanel({ transcript, thinking, disabled, onSend }: Props) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length, thinking]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (disabled || !draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  return (
    <section aria-label="Talk to the agent" className="border border-grey-200">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium hover:bg-tint"
      >
        Talk to the agent
        <span aria-hidden className="font-mono text-xs text-grey-500">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="border-t border-grey-200 p-3">
          <div ref={scroller} className="max-h-[260px] min-h-[92px] overflow-y-auto">
            {transcript.length === 0 && !thinking && (
              <p className="m-0 py-6 text-center text-[13px] text-grey-500">
                Ask the support agent for a refund. It will ask PromptFence first.
              </p>
            )}

            {transcript.map((turn, i) => (
              <div key={`${turn.ts}-${i}`} className={`mb-2 flex ${turn.role === "customer" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${turn.role === "customer" ? "bg-tint" : "bg-paper"} px-3 py-2`}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-grey-500">
                      {turn.role === "customer" ? "Customer" : turn.role === "agent" ? "Agent" : ""}
                    </span>
                    <span className="font-mono text-xs text-grey-400">{clockTime(turn.ts)}</span>
                  </div>
                  <p className={`m-0 mt-1 text-[13px] leading-normal ${turn.role === "error" ? "text-grey-500" : "text-ink"}`}>
                    {turn.text}
                  </p>
                  {turn.toolCalls?.map((call, k) => (
                    <ToolCallCard key={k} call={call} />
                  ))}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="mb-2 flex justify-start" aria-live="polite">
                <div className="bg-paper px-3 py-2">
                  <span className="sr-only">Agent is thinking</span>
                  <span aria-hidden className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="block h-1.5 w-1.5 animate-pf-pulse bg-grey-400"
                        style={{ animationDelay: `${d * 160}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                onClick={() => setDraft(preset)}
                className="border border-grey-200 px-2 py-1 font-mono text-xs text-grey-700 hover:bg-tint disabled:opacity-45"
              >
                {preset}
              </button>
            ))}
          </div>

          <form onSubmit={send} className="mt-2 flex gap-2">
            <input
              aria-label="Message to the agent"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled}
              placeholder="Refund ORD-1001, 42000 rupees…"
              className="h-9 min-w-0 flex-1 rounded border border-grey-200 bg-paper px-2.5 text-sm placeholder:text-grey-400 disabled:opacity-45"
            />
            <button
              type="submit"
              disabled={disabled || !draft.trim()}
              className="h-9 whitespace-nowrap rounded border border-ink bg-transparent px-3.5 text-sm font-medium transition-colors duration-150 hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent disabled:hover:text-ink"
            >
              {thinking ? "Agent is thinking…" : "Send"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
