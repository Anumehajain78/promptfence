"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AgentToolCall } from "@/lib/api";
import { clockTime, inr } from "@/lib/format";
import { ArrowRightIcon, SendIcon } from "./icons";
import { CARD, DecisionBadge, Eyebrow } from "./ui";
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
    <div className={`mt-3 rounded-[12px] border-l-[3px] bg-white px-4 py-3 ${CARD_BORDER[call.decision]}`}>
      <div className="font-mono text-[15px] text-ink [overflow-wrap:anywhere]">
        {call.tool}({order}, {amount})
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px]">
        <DecisionBadge decision={call.decision} />
        <span className="font-mono text-grey-700">{call.policy}</span>
        <span className="text-grey-700">executed: {call.executed ? "yes" : "no"}</span>
      </div>
    </div>
  );
}

/**
 * Talk to the agent. The card opens on the invitation; once there is a conversation it grows to hold it,
 * and the page scrolls, never the card. Suggestions fill the message box so you can read before you send.
 */
export function AgentPanel({ transcript, thinking, disabled, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!thinking && transcript.length) input.current?.focus({ preventScroll: true });
  }, [thinking, transcript.length]);

  return (
    <section aria-label="Talk to the agent" className={`${CARD} pf-rise p-[clamp(20px,2vw,30px)]`}>
      <Eyebrow>Talk to the agent</Eyebrow>
      <h2 className="m-0 mt-3 text-[clamp(24px,2.1vw,32px)] font-semibold leading-tight tracking-[-0.03em]">Ask the support agent for a refund.</h2>
      <p className="m-0 mt-1.5 text-[18px] text-grey-700">It will ask PromptFence first.</p>

      {(transcript.length > 0 || thinking) && (
        <div className="mt-6 border-t border-grey-200 pt-5">
          {transcript.map((turn, i) => (
            <div key={`${turn.ts}-${i}`} className={`mb-4 flex animate-pf-row ${turn.role === "customer" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] px-4 py-3 ${
                  turn.role === "customer" ? "rounded-[16px_16px_4px_16px] bg-ink text-paper" : "rounded-[16px_16px_16px_4px] bg-tint text-ink"
                }`}
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-[14px] font-medium">{turn.role === "customer" ? "Customer" : turn.role === "agent" ? "Agent" : ""}</span>
                  <span className={`font-mono text-[14px] ${turn.role === "customer" ? "text-grey-250" : "text-grey-700"}`}>{clockTime(turn.ts)}</span>
                </div>
                <p className="m-0 mt-1 text-[16px] leading-[1.5]">{turn.text}</p>
                {turn.toolCalls?.map((call, k) => (
                  <ToolCallCard key={k} call={call} />
                ))}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="mb-4 flex justify-start" aria-live="polite">
              <div className="rounded-[16px_16px_16px_4px] bg-tint px-4 py-3.5">
                <span className="sr-only">Agent is thinking</span>
                <span aria-hidden className="flex gap-1.5">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="block h-2 w-2 animate-pf-pulse rounded-[999px] bg-grey-700" style={{ animationDelay: `${d * 160}ms` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => {
              setDraft(preset);
              input.current?.focus({ preventScroll: true });
            }}
            className="group inline-flex min-h-[46px] cursor-pointer items-center gap-3 rounded-[12px] border border-grey-200 bg-white px-4 py-2 text-left text-[15px] leading-snug text-ink transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_8px_18px_-12px_rgba(20,20,19,0.4)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
          >
            {preset}
            <ArrowRightIcon className="shrink-0 text-grey-500 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink" />
          </button>
        ))}
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2.5">
        <input
          ref={input}
          aria-label="Message to the agent"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="Refund ORD-1001, 42000 rupees…"
          className="h-[54px] min-w-0 flex-1 rounded-[12px] border border-grey-250 bg-white px-4 text-[17px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-grey-500 focus:border-ink focus:shadow-[0_0_0_4px_rgba(184,242,39,0.35)] focus:outline-none disabled:opacity-45"
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          className="group inline-flex h-[54px] cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-[12px] bg-ink px-6 text-[16px] font-medium text-paper transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#262624] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
        >
          <SendIcon className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          {thinking ? "Agent is thinking…" : "Send"}
        </button>
      </form>
    </section>
  );
}
