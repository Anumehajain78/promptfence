import { Reveal } from "./Reveal";
import { Display, Kicker, PAGE_X, SECTION_Y } from "./ui";

const ACTIONS = [
  ["Refunds", "refund_order"],
  ["Payments", "charge_card"],
  ["Emails", "send_email"],
  ["Records", "delete_record"],
  ["APIs", "http_post"],
];

export function Problem() {
  return (
    <section aria-label="The problem" className="border-t border-grey-200">
      <div className={`mx-auto max-w-[1440px] ${PAGE_X} ${SECTION_Y}`}>
        <Reveal>
          <Kicker n="02">The problem</Kicker>
          <Display className="mt-[clamp(20px,3vw,40px)] text-[clamp(38px,7.6vw,124px)] leading-[0.92]">
            AI used to answer.
            <br />
            <span className="text-grey-400">Now it acts.</span>
          </Display>
        </Reveal>
        <div className="mt-[clamp(48px,7vw,110px)] grid items-end gap-x-16 gap-y-14 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          <Reveal className="border-t border-ink">
            {ACTIONS.map(([label, fn]) => (
              <div key={fn} className="flex items-baseline justify-between gap-4 border-b border-grey-200 py-4">
                <span className="text-[clamp(36px,6vw,96px)] font-light leading-none tracking-[-0.035em]">{label}</span>
                <span className="font-mono text-[13px] text-grey-500">{fn}</span>
              </div>
            ))}
          </Reveal>
          <Reveal delayMs={100}>
            <p className="m-0 max-w-[40ch] text-[clamp(16px,1.2vw,19px)] leading-[1.45] text-grey-700 [text-wrap:pretty]">
              Each of these is a real tool call with a real consequence. The model can reason its way to any of them. Reasoning is not authorization.
            </p>
            <Display as="div" className="mt-[clamp(28px,3vw,44px)] text-[clamp(34px,4.6vw,72px)]">
              Who decides?
            </Display>
            <div className="mt-[clamp(24px,3vw,40px)] grid grid-cols-[1fr_auto_1fr] items-center text-[13px] text-grey-500">
              <div className="flex items-center gap-3">
                <span>AI agent</span>
                <span className="h-px flex-1 bg-grey-200" />
              </div>
              <div className="flex flex-col items-center gap-2 px-3.5">
                <span className="text-ink">PromptFence</span>
                <span className="h-[72px] w-0.5 bg-lime outline outline-1 outline-ink" />
              </div>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-grey-200" />
                <span>Real tool</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
