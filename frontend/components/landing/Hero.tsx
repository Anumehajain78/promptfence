import { DecisionStream } from "./DecisionStream";
import { DASHBOARD, DASHBOARD_ATTACK, Display, Kicker, PAGE_X, PrimaryLink, SecondaryLink } from "./ui";

export function Hero() {
  return (
    <section id="top" aria-label="Hero" className={`mx-auto max-w-[1440px] pb-[clamp(64px,7vw,96px)] pt-[clamp(56px,8vw,112px)] ${PAGE_X}`}>
      <Kicker
        n="01"
        aside={
          <span className="flex gap-[18px] font-medium">
            <span className="text-allow">Allow</span>
            <span className="text-deny">Deny</span>
            <span className="text-amber">Approval</span>
          </span>
        }
      >
        A security control layer for AI agents
      </Kicker>
      <Display as="h1" className="mt-[clamp(28px,4vw,56px)] text-[clamp(40px,9.4vw,152px)] leading-[0.92]">
        AI can reason.
        <br />
        PromptFence decides.
      </Display>
      <div className="mt-[clamp(32px,4vw,56px)] grid items-end gap-x-12 gap-y-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <p className="m-0 max-w-[44ch] text-[clamp(17px,1.35vw,21px)] leading-snug text-grey-700 [text-wrap:pretty]">
          A security control layer between AI agents and the actions they are allowed to take. The model proposes. Policy decides. The tool only runs when it should.
        </p>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <PrimaryLink href={DASHBOARD_ATTACK}>Run attack simulation</PrimaryLink>
          <SecondaryLink href={DASHBOARD}>Enter the Control Room →</SecondaryLink>
        </div>
      </div>
      <DecisionStream />
    </section>
  );
}
