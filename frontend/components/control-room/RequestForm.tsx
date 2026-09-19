"use client";

import { useId, useState, type FormEvent } from "react";
import { ACTIONS, AGENTS } from "@/lib/api";
import { BoltIcon, ShieldIcon, UserIcon } from "./icons";
import { Select } from "./Select";
import { Eyebrow } from "./ui";
import type { ManualRequest } from "./useControlRoom";

interface Props {
  evaluating: boolean;
  disabled: boolean;
  onSubmit: (req: ManualRequest) => void;
}

const FIELD =
  "h-[54px] w-full rounded-[12px] border border-grey-250 bg-white text-[16px] text-ink transition-[border-color,box-shadow] duration-200 focus-within:border-ink focus-within:shadow-[0_0_0_4px_rgba(184,242,39,0.35)]";

/**
 * Send a request straight to PromptFence, without the agent in between. One row, read left to right as the
 * sentence it makes: this agent wants to do this action for this amount. Authorize.
 */
export function RequestForm({ evaluating, disabled, onSubmit }: Props) {
  const [agent, setAgent] = useState<string>("support-agent");
  const [action, setAction] = useState<string>("refund");
  const [amount, setAmount] = useState("9000");
  const amountOff = action !== "refund";
  const id = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled) onSubmit({ agent, action, amount });
  };

  return (
    <form onSubmit={submit}>
      <Eyebrow>Send a request</Eyebrow>
      <div className="mt-4 grid items-end gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.85fr)_auto]">
        <Select label="Agent" icon={<UserIcon />} value={agent} onChange={setAgent} disabled={disabled} options={AGENTS.map((a) => ({ value: a, label: a }))} />
        <Select label="Action" icon={<BoltIcon />} value={action} onChange={setAction} disabled={disabled} options={ACTIONS.map((a) => ({ value: a, label: `${a}()` }))} />
        <div className="grid min-w-0 gap-2">
          <label htmlFor={`${id}-amount`} className="text-[14px] font-medium text-grey-700">
            Amount
          </label>
          <div className={`flex items-center gap-2.5 px-4 ${FIELD} ${amountOff ? "opacity-45" : ""}`}>
            <span aria-hidden className="font-mono text-[17px] text-grey-700">
              ₹
            </span>
            <input
              id={`${id}-amount`}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              disabled={amountOff || disabled}
              aria-describedby={amountOff ? `${id}-amount-note` : undefined}
              className="h-full w-full min-w-0 border-0 bg-transparent p-0 font-mono text-[17px] tabular-nums outline-none disabled:cursor-not-allowed"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={disabled}
          className="group inline-flex h-[54px] cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-[12px] bg-ink px-6 text-[16px] font-medium text-paper transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#262624] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
        >
          <ShieldIcon className="text-lime transition-transform duration-200 group-hover:scale-110" />
          {evaluating ? "Evaluating…" : "Authorize"}
        </button>
      </div>
      {amountOff && (
        <p id={`${id}-amount-note`} className="m-0 mt-2.5 text-[14px] text-grey-700">
          Only refunds carry an amount.
        </p>
      )}
    </form>
  );
}
