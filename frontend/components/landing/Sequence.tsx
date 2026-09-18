"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/control-room/useReducedMotion";
import { REFUND_CEILING } from "@/lib/api";
import { inr, seqLabel } from "@/lib/format";
import { gsap, ScrollTrigger, PIN_MIN_WIDTH, prefersReducedMotion } from "./gsapSetup";
import { Display, Kicker, PAGE_X, SECTION_Y } from "./ui";
import { useInViewOnce } from "./useInView";

// Matches the backend: 39 refunds of ₹9,000 are allowed (₹3,51,000), #40 would
// reach ₹3,60,000 > ₹3,55,000 and is denied by cumulative-refund-ceiling-v1.
const AMOUNT = 9000;
const ALLOWED = 39;
const TOTAL = ALLOWED * AMOUNT;
const LEDGER_ROWS = 6;

export function Sequence() {
  const reducedMotion = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const totalRef = useRef<HTMLElement>(null);
  const [ref, inView] = useInViewOnce<HTMLDivElement>({ threshold: 0.3 });
  // 0…40. 40 is the blocked request.
  const [step, setStep] = useState(0);
  const blocked = step >= 40;

  // Desktop: scroll position drives the ledger while the section is pinned.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setStep(40);
      return;
    }
    const ctx = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add(`(min-width: ${PIN_MIN_WIDTH}px)`, () => {
        let shaken = false;
        ScrollTrigger.create({
          trigger: "[data-pin]",
          start: "top top",
          end: "+=300%",
          pin: true,
          scrub: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            const next = Math.round(self.progress * 40);
            setStep((current) => (current === next ? current : next));
            if (totalRef.current) {
              totalRef.current.textContent = inr(Math.min(self.progress * 40, ALLOWED) * AMOUNT);
            }
            if (next >= 40 && !shaken) {
              shaken = true;
              // The block lands: a short horizontal shake, once.
              gsap.fromTo("[data-shake]", { x: -4 }, { x: 4, duration: 0.05, repeat: 3, yoyo: true, clearProps: "x" });
            }
            if (next < 40) shaken = false;
          },
        });
      });

      // Mobile: no pin. The sequence plays once when the section is reached.
      media.add(`(max-width: ${PIN_MIN_WIDTH - 1}px)`, () => {
        ScrollTrigger.create({
          trigger: root.current,
          start: "top 70%",
          once: true,
          onEnter: () => {
            gsap.to(
              { v: 0 },
              {
                v: 40,
                duration: 4,
                ease: "power1.inOut",
                onUpdate() {
                  const v = (this.targets()[0] as { v: number }).v;
                  setStep(Math.round(v));
                  if (totalRef.current) totalRef.current.textContent = inr(Math.min(v, ALLOWED) * AMOUNT);
                },
              },
            );
          },
        });
      });
      return () => media.revert();
    }, root);
    return () => ctx.revert();
  }, []);

  // Reduced motion: show the finished state as soon as the section is reached.
  useEffect(() => {
    if (reducedMotion && inView) setStep(40);
  }, [reducedMotion, inView]);

  const passed = Math.min(step, ALLOWED);
  const rows: { n: number; decision: "Allow" | "Deny" }[] = [];
  for (let k = Math.max(1, passed - (blocked ? LEDGER_ROWS - 2 : LEDGER_ROWS - 1)); k <= passed; k++) {
    rows.push({ n: k, decision: "Allow" });
  }
  if (blocked) rows.push({ n: 40, decision: "Deny" });

  const status = blocked ? "Attack stopped" : step > 0 ? "Session live" : "Ready";
  const statusTone = blocked ? "text-deny" : step > 0 ? "text-allow" : "text-grey-500";
  const fenceTone = blocked ? "bg-deny-fill" : step > 0 ? "bg-allow-fill" : "bg-ink";

  return (
    <section ref={root} id="sequence" aria-label="Sequence-aware authorization" className="scroll-mt-16 border-t border-grey-200">
      <div ref={ref} data-pin className={`mx-auto max-w-[1440px] ${PAGE_X} ${SECTION_Y}`}>
        <div data-shake>
        <Kicker
          n="04"
          aside={
            <span role="status" aria-live="polite" className={`flex items-center gap-2 ${statusTone}`}>
              <span aria-hidden className={`h-[7px] w-[7px] ${blocked ? "bg-deny" : step > 0 ? "bg-allow" : "bg-grey-500"}`} />
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
            step >= 8 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          Forty requests tell
          <br />
          a different story.
        </Display>

        <div className="relative mt-[clamp(32px,4vw,56px)] grid border-b border-t border-grey-200 border-t-ink md:grid-cols-[minmax(0,1fr)_3px_minmax(0,1fr)]">
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
                  <span className={`text-right font-sans text-sm font-medium ${r.decision === "Deny" ? "text-deny" : "text-allow"}`}>
                    {r.decision}
                  </span>
                </div>
              ))}
            </div>
            {blocked && (
              <p className="mt-2 px-1.5 text-[13px] leading-normal text-deny">
                Session refunds would reach {inr(TOTAL + AMOUNT)}, above the {inr(REFUND_CEILING)} session ceiling.
              </p>
            )}
            <p className={`mt-2 px-1.5 text-[13px] ${blocked ? "text-ink" : "text-grey-500"}`}>
              {blocked ? "per-call checks cannot see this." : "keep scrolling"}
            </p>
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
                    k < passed ? "border-allow-fill bg-allow-fill" : k === 39 && blocked ? "border-deny-fill" : "border-grey-200"
                  }`}
                />
              ))}
            </div>
            <div className={`mt-3.5 text-[13px] tabular-nums ${blocked ? "text-deny" : "text-grey-500"}`}>
              {blocked ? (
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
          <div className="border-b border-grey-100 py-[22px] pr-[clamp(12px,2vw,28px)]">
            <dt className="text-[13px] text-grey-500">Session total</dt>
            <dd
              ref={totalRef}
              className={`m-0 mt-2 font-mono text-[clamp(30px,3.6vw,56px)] font-medium leading-none tracking-[-0.04em] tabular-nums transition-colors duration-200 ${
                blocked ? "text-deny" : "text-ink"
              }`}
            >
              {inr(passed * AMOUNT)}
            </dd>
          </div>
          {[
            { k: "Policy limit", v: inr(REFUND_CEILING), tone: "text-ink", mono: true },
            { k: "Request", v: inr(AMOUNT), tone: "text-ink", mono: true },
            { k: "Decision", v: blocked ? "Deny" : step > 0 ? "Allow" : "—", tone: blocked ? "text-deny" : step > 0 ? "text-allow" : "text-ink", mono: false },
          ].map((stat) => (
            <div key={stat.k} className="border-b border-grey-100 py-[22px] pr-[clamp(12px,2vw,28px)]">
              <dt className="text-[13px] text-grey-500">{stat.k}</dt>
              <dd
                className={`m-0 mt-2 text-[clamp(30px,3.6vw,56px)] font-medium leading-none tracking-[-0.04em] tabular-nums ${
                  stat.mono ? "font-mono" : ""
                } ${stat.tone}`}
              >
                {stat.v}
              </dd>
            </div>
          ))}
        </dl>

        <div
          aria-hidden={!blocked}
          className={`mt-[clamp(32px,4vw,56px)] grid items-end gap-x-16 gap-y-10 transition-[opacity,transform] duration-[400ms] [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] ${
            blocked ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
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

        <p className="mt-[clamp(28px,3vw,40px)] text-[13px] text-grey-500">
          Demo data · 40 requests · <span className="font-mono">{inr(AMOUNT)}</span> each
        </p>
        </div>
      </div>
    </section>
  );
}
