import Link from "next/link";
import { Logo } from "@/components/site/Logo";
import { PlayIcon, ResetIcon } from "./icons";

interface Props {
  sessionId: string | null;
  agent: string;
  customer: string;
  running: boolean;
  blocked: boolean;
  disabled: boolean;
  onRun: () => void;
  onReset: () => void;
}

/**
 * On desktop the bar stays with you as the page scrolls (on a phone it would eat the screen, so there it
 * scrolls away): brand, the session you are watching, and the two actions.
 * The attack simulation is the room's primary action, so it is the only solid button in the bar.
 */
export function TopBar({ sessionId, agent, customer, running, blocked, disabled, onRun, onReset }: Props) {
  const runLabel = running ? "Running…" : blocked ? "Replay attack simulation" : "Run attack simulation";
  return (
    <header className="top-0 z-20 border-b lg:sticky border-grey-200 bg-[color-mix(in_srgb,var(--c-paper)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-[clamp(16px,2.5vw,40px)] py-3.5">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="PromptFence home" className="text-ink no-underline transition-opacity duration-150 hover:opacity-70">
            <Logo />
          </Link>
          <span aria-hidden className="hidden h-6 w-px bg-grey-250 sm:block" />
          <span className="hidden text-[18px] text-grey-700 sm:block">Control Room</span>
        </div>

        <div className="order-last flex w-full justify-center lg:order-none lg:w-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[12px] border border-grey-200 bg-white px-4 py-2 font-mono text-[15px] text-ink">
            <span>{sessionId ?? "—"}</span>
            <span aria-hidden className="text-grey-400">·</span>
            <span>{agent}</span>
            <span aria-hidden className="text-grey-400">·</span>
            <span>{customer}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onRun}
            disabled={disabled}
            className="group inline-flex h-[46px] cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-[12px] bg-ink px-5 text-[16px] font-medium text-paper shadow-[0_8px_20px_-10px_rgba(20,20,19,0.55)] transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#262624] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
          >
            <PlayIcon className="text-lime transition-transform duration-200 group-hover:scale-110" />
            {runLabel}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="group inline-flex h-[46px] cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-[12px] border border-grey-250 bg-white px-5 text-[16px] font-medium text-ink transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-ink active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
          >
            <ResetIcon className="transition-transform duration-300 group-hover:-rotate-90" />
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
