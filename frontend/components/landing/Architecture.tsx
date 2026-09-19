import { Reveal } from "./Reveal";
import { Display, Kicker, PAGE_X, SECTION_Y } from "./ui";

// Only services the backend runs (backend/template.yaml). The design also listed
// Step Functions for approval & execution; that is not built, so it is omitted.
const SERVICES = [
  { n: "01", name: "Strands + Bedrock", job: "Agent runtime" },
  { n: "02", name: "API Gateway", job: "Every tool call enters" },
  { n: "03", name: "Lambda", job: "Runs the fence" },
];

const FENCE_PARTS = [
  { glyph: "├", name: "Cedar", job: "policy evaluation" },
  { glyph: "├", name: "DynamoDB", job: "session context" },
  { glyph: "└", name: "EventBridge", job: "decision events" },
];

function Row({ n, name, job, jobTone = "text-grey-500" }: { n: string; name: string; job: string; jobTone?: string }) {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-grey-200 py-[18px]">
      <span className="font-mono text-[13px] tabular-nums text-grey-500">{n}</span>
      <span className="text-[clamp(18px,1.6vw,24px)] font-medium tracking-[-0.02em]">{name}</span>
      <span className={`text-right text-[13px] ${jobTone}`}>{job}</span>
    </div>
  );
}

export function Architecture() {
  return (
    <section id="aws" aria-label="Architecture" className="scroll-mt-24 md:scroll-mt-16">
      <div className={`mx-auto max-w-[1440px] ${PAGE_X} ${SECTION_Y}`}>
        <Kicker aside={<span>Only the services we run</span>}>
          Architecture
        </Kicker>
        <div className="mt-[clamp(20px,3vw,40px)] grid items-start gap-x-16 gap-y-10 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <Reveal>
            <Display className="text-[clamp(38px,6.6vw,108px)] leading-[0.92]">
              Runs on AWS.
              <br />
              <span className="text-grey-400">
                One path.
                <br />
                No bypass.
              </span>
            </Display>
          </Reveal>
          <Reveal delayMs={100} className="border-t border-ink">
            {SERVICES.map((s) => (
              <Row key={s.n} {...s} />
            ))}
            <div className="-ml-px border-b border-l-[3px] border-b-grey-200 border-l-lime py-[18px] pl-4">
              <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-baseline gap-4">
                <span className="font-mono text-[13px] tabular-nums text-grey-500">04</span>
                <span className="text-[clamp(18px,1.6vw,24px)] font-semibold tracking-[-0.02em]">PromptFence</span>
                <span className="text-right text-[13px] text-ink">Allow · Deny · Approval</span>
              </div>
              <div className="mt-3.5 grid gap-2 text-[13px] leading-normal">
                {FENCE_PARTS.map((p) => (
                  <div key={p.name} className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-4">
                    <span aria-hidden className="font-mono text-grey-400">
                      {p.glyph}
                    </span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-right text-grey-500">{p.job}</span>
                  </div>
                ))}
              </div>
            </div>
            <Row n="05" name="Real tool" job="Called only on Allow" jobTone="text-allow" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
