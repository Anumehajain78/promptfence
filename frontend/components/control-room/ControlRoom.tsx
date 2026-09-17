"use client";

import { REFUND_CEILING } from "@/lib/api";
import { DecisionPanel } from "./DecisionPanel";
import { ErrorLine } from "./ErrorLine";
import { FenceChart } from "./FenceChart";
import { FooterLine } from "./FooterLine";
import { PolicyStrip } from "./PolicyStrip";
import { RequestForm } from "./RequestForm";
import { RequestLedger } from "./RequestLedger";
import { SessionTotal } from "./SessionTotal";
import { TopBar } from "./TopBar";
import { isCeilingBlock, rowNumber } from "./decision";
import { useControlRoom } from "./useControlRoom";
import { useReducedMotion } from "./useReducedMotion";

const DEMO_CUSTOMER = "#CUST-4474";

export function ControlRoom() {
  const reducedMotion = useReducedMotion();
  const room = useControlRoom(reducedMotion);
  const { rows, loading, busy, error, selected } = room;

  const blocked = rows.some(isCeilingBlock);
  const last = rows.length ? rows[rows.length - 1] : null;
  const selectedIndex = rows.findIndex((r, i) => rowNumber(r, i) === selected);
  const selectedRow = selectedIndex >= 0 ? rows[selectedIndex] : last;
  const selectedNumber = selectedRow ? rowNumber(selectedRow, selectedIndex >= 0 ? selectedIndex : rows.length - 1) : null;
  const total = last ? last.session_total_after : 0;
  const agent = rows[0]?.agent ?? "support-agent";
  const locked = busy !== "idle" || loading;

  return (
    <div className="grid min-h-[640px] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-x-hidden lg:h-screen lg:overflow-hidden">
      <TopBar
        sessionId={room.sessionId}
        agent={agent}
        customer={DEMO_CUSTOMER}
        running={busy === "attack"}
        blocked={blocked}
        disabled={locked}
        onRun={room.runAttack}
        onReset={room.reset}
      />
      <div>{error && <ErrorLine message={error} />}</div>

      <main className="grid min-h-0 grid-cols-1 [grid-template-areas:'b'_'a'_'c'] lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:[grid-template-areas:'a_b'_'a_c']">
        <section
          aria-label="Requests"
          className="grid min-h-0 grid-rows-[auto_auto_auto_auto] border-b border-grey-200 px-[clamp(16px,2.4vw,32px)] py-[clamp(16px,2vw,28px)] [grid-area:a] lg:grid-rows-[auto_auto_auto_minmax(0,1fr)] lg:border-b-0 lg:border-r"
        >
          <RequestForm evaluating={busy === "authorize"} disabled={locked} onSubmit={room.submit} />
          <PolicyStrip />
          <RequestLedger rows={rows} loading={loading} selected={selectedNumber} onSelect={room.setSelected} />
        </section>

        <section
          aria-label="Session total vs policy limit"
          className="flex flex-col border-b border-grey-200 px-[clamp(16px,2.4vw,32px)] py-[clamp(16px,2vw,28px)] [grid-area:b]"
        >
          <FenceChart rows={rows} loading={loading} limit={REFUND_CEILING} />
          <SessionTotal value={total} limit={REFUND_CEILING} blocked={blocked} reducedMotion={reducedMotion} />
        </section>

        <DecisionPanel row={selectedRow} number={selectedNumber} />
      </main>

      <FooterLine rows={rows} loading={loading} />
    </div>
  );
}
