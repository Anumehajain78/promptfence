"use client";

import { useEffect, useRef } from "react";
import { REFUND_CEILING } from "@/lib/api";
import { AgentPanel } from "./AgentPanel";
import { DecisionPanel } from "./DecisionPanel";
import { ErrorLine } from "./ErrorLine";
import { PolicyStrip } from "./PolicyStrip";
import { RequestForm } from "./RequestForm";
import { RequestLedger } from "./RequestLedger";
import { SessionBand } from "./SessionBand";
import { TopBar } from "./TopBar";
import { isCeilingBlock, rowNumber } from "./decision";
import { CARD } from "./ui";
import { useControlRoom } from "./useControlRoom";
import { useReducedMotion } from "./useReducedMotion";

const DEMO_CUSTOMER = "#CUST-4474";

/**
 * The Control Room, on one page:
 *
 *   [ Talk to the agent            ] [ Session total vs policy limit ]   ask, and watch what it does to
 *   [ Send a request · Policy rules ] [          (on black)           ]   the session
 *   [ Requests                                  ] [ Decision          ]   then inspect any request
 *
 * White cards on the paper ground, with the session as the one black card so it is the first thing the eye
 * lands on. Nothing scrolls inside itself; only the page scrolls, and the bar stays with you.
 */
export function ControlRoom() {
  const reducedMotion = useReducedMotion();
  const room = useControlRoom(reducedMotion);
  const { rows, loading, busy, error, selected } = room;

  const blocked = rows.some(isCeilingBlock);
  const last = rows.length ? rows[rows.length - 1] : null;
  const selectedIndex = rows.findIndex((r, i) => rowNumber(r, i) === selected);
  const selectedRow = selectedIndex >= 0 ? rows[selectedIndex] : last;
  const selectedNumber = selectedRow ? rowNumber(selectedRow, selectedIndex >= 0 ? selectedIndex : rows.length - 1) : null;
  const pinned = selectedIndex >= 0 && selectedIndex !== rows.length - 1;
  const total = last ? last.session_total_after : 0;
  const agent = rows[0]?.agent ?? "support-agent";
  const locked = busy !== "idle" || loading;

  // Landing page links here with ?attack=1: start the attack once the session has loaded,
  // and drop the param so a reload does not re-run it.
  const autoStarted = useRef(false);
  const { sessionId, runAttack } = room;
  useEffect(() => {
    if (autoStarted.current || loading || !sessionId || busy !== "idle") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("attack") !== "1") return;
    autoStarted.current = true;
    url.searchParams.delete("attack");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    runAttack();
  }, [busy, loading, runAttack, sessionId]);

  return (
    <div className="min-h-dvh bg-paper text-[16px] leading-normal text-ink">
      <h1 className="sr-only">PromptFence Control Room</h1>
      <TopBar
        sessionId={sessionId}
        agent={agent}
        customer={DEMO_CUSTOMER}
        running={busy === "attack"}
        blocked={blocked}
        disabled={locked}
        onRun={room.runAttack}
        onReset={room.reset}
      />
      {error && <ErrorLine message={error} />}

      <main className="mx-auto grid max-w-[1560px] gap-[clamp(16px,1.6vw,24px)] px-[clamp(16px,2.5vw,40px)] pb-[clamp(32px,4vw,64px)] pt-[clamp(16px,1.8vw,28px)] xl:grid-cols-12">
        <div className="grid content-start gap-[clamp(16px,1.6vw,24px)] xl:col-span-7">
          <AgentPanel transcript={room.transcript} thinking={busy === "chat"} disabled={locked} onSend={room.sendChat} />
          <section aria-label="Send a request" className={`${CARD} pf-rise grid gap-7 p-[clamp(20px,2vw,30px)] [animation-delay:80ms]`}>
            <RequestForm evaluating={busy === "authorize"} disabled={locked} onSubmit={room.submit} />
            <div className="border-t border-grey-200 pt-6">
              <PolicyStrip decidedBy={selectedRow?.policy ?? null} />
            </div>
          </section>
        </div>

        <div className="xl:col-span-5">
          <SessionBand
            rows={rows}
            loading={loading}
            total={total}
            limit={REFUND_CEILING}
            blocked={blocked}
            running={busy === "attack"}
            reducedMotion={reducedMotion}
            className="pf-rise [animation-delay:120ms] xl:sticky xl:top-[92px]"
          />
        </div>

        <div className="xl:col-span-8">
          <RequestLedger rows={rows} loading={loading} selected={selectedNumber} onSelect={room.setSelected} />
        </div>
        <div className="xl:col-span-4">
          <DecisionPanel
            row={selectedRow}
            number={selectedNumber}
            onClose={pinned ? () => room.setSelected(null) : undefined}
            className="xl:sticky xl:top-[92px]"
          />
        </div>
      </main>
    </div>
  );
}
