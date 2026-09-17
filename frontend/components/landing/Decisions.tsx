"use client";

import { useState } from "react";
import { Reveal } from "./Reveal";
import { Display, Kicker, PAGE_X, SECTION_Y, StopMark } from "./ui";

type Path = "allow" | "deny" | "approval";

// Examples match the backend policies: refunds ≤ ₹10,000 are allowed, refunds
// above ₹10,000 are held for a human, and #40 hits the session ceiling.
const PATHS: {
  id: Path;
  action: string;
  detail: string;
  word: string;
  wordTone: string;
  outcome: string;
  outcomeNote: string;
}[] = [
  { id: "allow", action: "refund", detail: "₹9,000 · #4474", word: "Allow", wordTone: "text-allow", outcome: "Real tool", outcomeNote: "executed" },
  { id: "deny", action: "refund", detail: "₹9,000 · #40", word: "Deny", wordTone: "text-deny", outcome: "Stop", outcomeNote: "tool not called" },
  { id: "approval", action: "refund", detail: "₹42,000 · #4474", word: "Approval", wordTone: "text-amber", outcome: "Human", outcomeNote: "approve · deny" },
];

function Track({ path, on }: { path: Path; on: boolean }) {
  const fence = !on ? "bg-ink" : path === "allow" ? "bg-allow-fill" : path === "deny" ? "bg-deny-fill" : "bg-amber-fill";
  const color = path === "allow" ? "bg-allow-fill" : path === "deny" ? "bg-deny-fill" : "bg-amber-fill";
  return (
    <div aria-hidden className="relative h-11">
      <span className="absolute left-0 right-0 top-1/2 h-px bg-grey-200" />
      <span
        className={`absolute left-0 top-1/2 -mt-px h-0.5 w-1/2 origin-left transition-transform duration-[400ms] ease-out ${color} ${on ? "scale-x-100" : "scale-x-0"}`}
      />
      {path === "allow" && (
        <span
          className={`absolute left-1/2 top-1/2 -mt-px h-0.5 w-1/2 origin-left bg-allow-fill transition-transform duration-[400ms] ease-out ${
            on ? "scale-x-100 delay-[400ms]" : "scale-x-0"
          }`}
        />
      )}
      {path === "approval" && (
        <span
          className={`absolute left-1/2 top-1/2 -mt-px h-0 w-1/2 origin-left border-t-2 border-dashed border-amber-fill transition-transform duration-[400ms] ease-out ${
            on ? "scale-x-100 delay-[400ms]" : "scale-x-0"
          }`}
        />
      )}
      <span className={`absolute -bottom-[29px] -top-7 left-1/2 -ml-px w-0.5 transition-colors duration-300 ${fence}`} />
      {path === "deny" && (
        <StopMark className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`} />
      )}
      {path === "approval" && (
        <span
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded border border-amber-fill bg-paper px-2 py-0.5 text-xs text-amber transition-opacity duration-300 ${
            on ? "opacity-100" : "opacity-0"
          }`}
        >
          Held
        </span>
      )}
    </div>
  );
}

export function Decisions() {
  const [active, setActive] = useState<Path>("allow");
  return (
    <section id="decisions" aria-label="Three decisions" className="border-t border-grey-200">
      <div className={`mx-auto max-w-[1440px] ${PAGE_X} ${SECTION_Y}`}>
        <Reveal>
          <Kicker n="05" aside={<span>Hover or tap a path</span>}>
            Three decisions
          </Kicker>
          <Display className="mt-[clamp(20px,3vw,40px)] text-[clamp(38px,6.6vw,108px)] leading-[0.92]">
            Every request
            <br />
            ends one of
            <br />
            <span className="text-grey-400">three ways.</span>
          </Display>
        </Reveal>

        <Reveal className="mt-[clamp(40px,5vw,72px)] border-t border-ink">
          {PATHS.map((p) => {
            const on = active === p.id;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                onMouseEnter={() => setActive(p.id)}
                onFocus={() => setActive(p.id)}
                onClick={() => setActive(p.id)}
                className="grid cursor-pointer grid-cols-[minmax(88px,0.9fr)_minmax(0,2.2fr)_minmax(88px,0.9fr)] items-center gap-x-[clamp(12px,2vw,28px)] gap-y-3 border-b border-grey-200 py-7 outline-offset-[-2px]"
              >
                <div className="text-[13px] leading-normal">
                  <div className="font-mono font-medium">{p.action}()</div>
                  <div className="font-mono text-grey-500">{p.detail}</div>
                  <div className={`mt-2 font-medium ${p.wordTone}`}>{p.word}</div>
                </div>
                <Track path={p.id} on={on} />
                <div className={`text-right transition-colors duration-300 ${on ? "text-ink" : "text-grey-400"}`}>
                  <div className="text-[clamp(20px,2.2vw,32px)] font-medium leading-none tracking-[-0.03em]">{p.outcome}</div>
                  <div className="mt-1.5 text-[13px] text-grey-500">{p.outcomeNote}</div>
                </div>
              </div>
            );
          })}
        </Reveal>
        <Reveal>
          <p className="m-0 mt-[clamp(24px,3vw,40px)] max-w-[52ch] text-[clamp(15px,1.1vw,17px)] leading-normal text-grey-700 [text-wrap:pretty]">
            One fence, three outcomes. Allowed requests cross to the real tool. Denied requests stop at the boundary and the tool is never called. Requests that need a person wait at the fence until a human approves or denies.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
