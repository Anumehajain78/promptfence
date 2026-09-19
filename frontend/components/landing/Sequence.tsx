"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/control-room/useReducedMotion";
import { REFUND_CEILING } from "@/lib/api";
import { inr, seqLabel } from "@/lib/format";
import { DASHBOARD_ATTACK, Display, Kicker, PAGE_X, PrimaryLink, SECTION_Y } from "./ui";
import { useInViewOnce } from "./useInView";

type Phase = "idle" | "running" | "approach" | "denied";

// Matches the backend: 39 refunds of ₹9,000 are allowed (₹3,51,000), #40 would
// reach ₹3,60,000 > ₹3,55,000 and is denied by cumulative-refund-ceiling-v1.
const AMOUNT = 9000;
const ALLOWED = 39;
const LEDGER_ROWS = 6;

export function Sequence() {
  const reducedMotion = useReducedMotion();
  const [ref, inView] = useInViewOnce<HTMLDivElement>({ threshold: 0.3 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [passed, setPassed] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) {
      setPassed(ALLOWED);
      setPhase("denied");
      return;
    }
    // Wall-clock schedule (from the design): fast early, slower near the limit.
    const start = performance.now() + 300;
    const at: number[] = [];
    let t = 0;
    for (let n = 1; n <= ALLOWED; n++) {
      at.push(start + t);
      t += n < 28 ? Math.max(80, 360 - n * 11) : n < 35 ? 100 : 340;
    }
    const approachAt = start + t + 500;
    const deniedAt = approachAt + 1300;

    setPhase("running");
    let timer = 0;
    const tick = () => {
      const now = performance.now();
      if (now >= deniedAt) {
        setPassed(ALLOWED);
        setPhase("denied");
        return;
      }
      if (now >= approachAt) {
        setPassed(ALLOWED);
        setPhase("approach");
        timer = window.setTimeout(tick, deniedAt - now);
        return;
      }
      let n = 0;
      while (n < ALLOWED && now >= at[n]) n++;
      setPassed(n);
      timer = window.setTimeout(tick, Math.max(16, (n < ALLOWED ? at[n] : approachAt) - now));
    };
    timer = window.setTimeout(tick, 300);
    return () => window.clearTimeout(timer);
  }, [inView, reducedMotion]);

  const denied = phase === "denied";
  const approach = phase === "approach";
  const running = phase === "running";

  const rows: { n: number; decision: "Allow" | "…" | "Deny" }[] = [];
  for (let k = Math.max(1, passed - (approach || denied ? LEDGER_ROWS - 2 : LEDGER_ROWS - 1)); k <= passed; k++) {
    rows.push({ n: k, decision: "Allow" });
  }
  if (approach) rows.push({ n: 40, decision: "…" });
  if (denied) rows.push({ n: 40, decision: "Deny" });

  const status = denied ? "Attack stopped" : approach ? "Evaluating #40" : running ? "Session live" : "Ready";
  const statusTone = denied ? "text-deny" : running || approach ? "text-allow" : "text-grey-500";
  const dotTone = denied ? "bg-deny" : running || approach ? "bg-allow" : "bg-grey-500";
  const fenceTone = denied ? "bg-deny-fill" : approach ? "bg-lime" : running ? "bg-allow-fill" : "bg-ink";

  return (
    <section id="sequence" aria-label="Sequence-aware authorization" className="scroll-mt-24 md:scroll-mt-16">
      <div ref={ref} className={`mx-auto max-w-[1440px] ${PAGE_X} ${SECTION_Y}`}>
        <Kicker
          aside={
            <span role="status" aria-live="polite" className={`flex items-center gap-2 ${statusTone}`}>
              <span aria-hidden className={`h-[7px] w-[7px] ${dotTone}`} />
              {status}
            </span>
          }
        >
          Sequence-aware authorization
        </Kicker>
        <Display className="mt-[clamp(20px,3vw,40px)] text-[clamp(38px,6.6vw,108px)] leading-[0.92]">
          One request
          <br />
          looks fine.
        </Display>
        <Display
          as="div"
          className={`mt-3.5 text-[clamp(38px,6.6vw,108px)] leading-[0.92] text-grey-400 transition-[opacity,transform] duration-[400ms] ${
            passed >= 8 || denied ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          Forty requests tell
          <br />
          a different story.
        </Display>

        <div className="relative mt-[clamp(40px,5vw,72px)] grid border-b border-t border-grey-200 border-t-ink md:grid-cols-[minmax(0,1fr)_3px_minmax(0,1fr)]">
          <span aria-hidden className="absolute -top-2 left-1/2 z-[2] hidden -translate-x-1/2 bg-paper px-2 text-xs text-ink md:block">
            PromptFence
          </span>

          <div className="relative flex flex-col py-[22px] md:pr-[clamp(12px,2vw,28px)]">
            <div className="flex justify-between gap-3 text-[13px] text-grey-500">
              <span>
                Requests · <span className="font-mono">support-agent</span>
              </span>
              <span className="font-mono">#CUST-4474</span>
            </div>
            {/* Fixed height: rows fill from the bottom, the section never reflows. */}
            <div aria-label="Request ledger" className="mt-3 flex h-[216px] flex-col justify-end">
              {rows.map((r) => (
                <div
                  key={`${r.n}-${r.decision}`}
                  className={`grid h-9 shrink-0 grid-cols-[44px_minmax(0,1fr)_auto_64px] items-center gap-3 border-b border-grey-100 px-1.5 font-mono text-[13px] tabular-nums ${
                    r.decision === "Deny" ? "bg-deny-fill/[0.08]" : ""
                  }`}
                >
                  <span className="text-grey-500">{seqLabel(r.n)}</span>
                  <span className="truncate">refund()</span>
                  <span>{inr(AMOUNT)}</span>
                  <span
                    className={`text-right font-sans text-sm font-medium ${
                      r.decision === "Deny" ? "text-deny" : r.decision === "Allow" ? "text-allow" : "text-ink"
                    }`}
                  >
                    {r.decision}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div aria-hidden className={`h-[3px] transition-colors duration-300 md:h-auto ${fenceTone}`} />

          <div className="flex flex-col py-[22px] md:pl-[clamp(12px,2vw,28px)]">
            <div className="flex justify-between gap-3 text-[13px] text-grey-500">
              <span>
                Real tool · <span className="font-mono">refund()</span>
              </span>
              <span className="text-ink">
                Executed <span className="font-mono tabular-nums">{passed}</span>
              </span>
            </div>
            <div aria-label="Tool executions" className="mt-4 grid flex-1 content-end gap-1.5 [grid-template-columns:repeat(8,minmax(0,1fr))]">
              {Array.from({ length: 40 }, (_, k) => (
                <span
                  key={k}
                  className={`block aspect-square border transition-colors duration-200 ${
                    k < passed ? "border-allow-fill bg-allow-fill" : k === 39 && denied ? "border-deny-fill" : "border-grey-200"
                  }`}
                />
              ))}
            </div>
            <div className={`mt-3.5 text-[13px] tabular-nums ${denied ? "text-deny" : "text-grey-500"}`}>
              {denied ? (
                <>
                  <span className="font-mono">#40</span> not called · attack stopped
                </>
              ) : passed ? (
                <>
                  {passed} refunds issued · <span className="font-mono">{inr(passed * AMOUNT)}</span>
                </>
              ) : (
                "Awaiting requests"
              )}
            </div>
          </div>
        </div>

        <dl className="m-0 grid border-b border-grey-200 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          {[
            { k: "Session total", v: inr(passed * AMOUNT), tone: "text-ink" },
            { k: "Policy limit", v: inr(REFUND_CEILING), tone: "text-ink" },
            { k: "Request", v: inr(AMOUNT), tone: "text-ink" },
            {
              k: "Decision",
              v: denied ? "Deny" : approach ? "…" : running ? "Allow" : "—",
              tone: denied ? "text-deny" : running ? "text-allow" : "text-ink",
              sans: true,
            },
          ].map((stat) => (
            <div key={stat.k} className="border-b border-grey-100 py-[22px] pr-[clamp(12px,2vw,28px)]">
              <dt className="text-[13px] text-grey-500">{stat.k}</dt>
              <dd
                className={`m-0 mt-2 text-[clamp(30px,3.6vw,56px)] font-medium leading-none tracking-[-0.04em] tabular-nums transition-colors duration-300 ${
                  stat.sans ? "" : "font-mono"
                } ${stat.tone}`}
              >
                {stat.v}
              </dd>
            </div>
          ))}
        </dl>

        <div
          aria-hidden={!denied}
          className={`mt-[clamp(40px,5vw,72px)] grid items-end gap-x-16 gap-y-10 transition-[opacity,transform] duration-[400ms] [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] ${
            denied ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <dl className="m-0 border-t border-ink text-[13px]">
            {[
              ["policy", "cumulative-refund-ceiling-v1", "font-mono text-ink"],
              ["reason", "Cumulative session limit exceeded", "text-ink"],
              ["tool_execution", "Not called", "text-deny"],
              ["attack", "Stopped", "text-deny"],
            ].map(([k, v, tone]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-grey-100 py-[9px]">
                <dt className="font-mono text-grey-500">{k}</dt>
                <dd className={`m-0 text-right font-medium ${tone}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <Display as="h3" className="text-[clamp(34px,5vw,80px)]">
            Legal individually.
            <br />
            <span className="text-deny">Dangerous together.</span>
          </Display>
        </div>

        <div className="mt-[clamp(36px,4vw,56px)] flex flex-wrap items-center gap-5">
          <PrimaryLink href={DASHBOARD_ATTACK}>Run attack simulation</PrimaryLink>
          <span className="text-[13px] text-grey-500">
            Demo data · 40 requests · <span className="font-mono">{inr(AMOUNT)}</span> each
          </span>
        </div>
      </div>
    </section>
  );
}
