"use client";

import { useState, type FormEvent } from "react";
import { ACTIONS, AGENTS } from "@/lib/api";
import type { ManualRequest } from "./useControlRoom";

interface Props {
  evaluating: boolean;
  disabled: boolean;
  onSubmit: (req: ManualRequest) => void;
}

export function RequestForm({ evaluating, disabled, onSubmit }: Props) {
  const [agent, setAgent] = useState<string>("support-agent");
  const [action, setAction] = useState<string>("refund");
  const [amount, setAmount] = useState("9000");
  const amountOff = action !== "refund";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled) onSubmit({ agent, action, amount });
  };

  const control = "h-9 rounded border border-grey-200 bg-paper px-2.5 font-mono text-[13px] disabled:opacity-45";

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 border-b border-grey-200 pb-3.5 text-sm">
      <span className="mr-1 text-grey-500">Send a request</span>
      <select aria-label="Agent" value={agent} onChange={(e) => setAgent(e.target.value)} disabled={disabled} className={control}>
        {AGENTS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)} disabled={disabled} className={control}>
        {ACTIONS.map((a) => (
          <option key={a} value={a}>
            {a}()
          </option>
        ))}
      </select>
      <label className={`flex h-9 items-center gap-1.5 rounded border border-grey-200 px-2.5 ${amountOff ? "opacity-45" : ""}`}>
        <span className="font-mono text-[13px] text-grey-500">₹</span>
        <input
          aria-label="Amount"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          disabled={amountOff || disabled}
          className="w-[84px] border-0 bg-transparent p-0 font-mono text-[13px] tabular-nums outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={disabled}
        className="h-9 rounded border border-ink bg-transparent px-3.5 text-sm font-medium transition-colors duration-150 hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent disabled:hover:text-ink"
      >
        {evaluating ? "Evaluating…" : "Authorize"}
      </button>
    </form>
  );
}
