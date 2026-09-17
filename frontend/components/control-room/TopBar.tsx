import Link from "next/link";

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

export function TopBar({ sessionId, agent, customer, running, blocked, disabled, onRun, onReset }: Props) {
  const runLabel = running ? "Running…" : blocked ? "Replay attack simulation" : "Run attack simulation";
  return (
    <header className="grid grid-cols-1 items-center gap-4 border-b border-grey-200 px-[clamp(16px,2.4vw,32px)] py-3 lg:grid-cols-[auto_1fr_auto]">
      <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap font-medium text-ink no-underline hover:text-grey-500">
        <span aria-hidden className="block h-4 w-0.5 bg-ink" />
        PromptFence · Control Room
      </Link>
      <div className="hidden text-center font-mono text-[13px] text-grey-500 lg:block">
        {sessionId ?? "—"} · {agent} · {customer}
      </div>
      <div className="flex min-w-0 flex-wrap justify-start gap-2 lg:justify-end">
        <button
          type="button"
          onClick={onRun}
          disabled={disabled}
          className="h-9 whitespace-nowrap rounded border border-ink bg-ink px-4 text-sm font-medium text-paper transition-[background-color,transform] duration-150 hover:bg-grey-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
        >
          {runLabel}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="h-9 whitespace-nowrap rounded border border-ink bg-transparent px-4 text-sm font-medium text-ink transition-colors duration-150 hover:bg-tint disabled:cursor-not-allowed disabled:opacity-55"
        >
          Reset
        </button>
      </div>
    </header>
  );
}
