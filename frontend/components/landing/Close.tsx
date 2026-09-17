import { Reveal } from "./Reveal";
import { DASHBOARD, DASHBOARD_ATTACK, Display, Kicker, PAGE_X, PrimaryLink, SecondaryLink, StopMark } from "./ui";

export function Close() {
  return (
    <section aria-label="Close" className="border-t border-grey-200">
      <div className={`mx-auto max-w-[1440px] pb-[clamp(64px,7vw,96px)] pt-[clamp(96px,13vw,200px)] ${PAGE_X}`}>
        <Reveal>
          <Kicker n="07">The tool never ran</Kicker>
          <Display className="mt-[clamp(20px,3vw,40px)] text-[clamp(38px,7.6vw,124px)] font-normal leading-[0.92]">
            The most important call
            <br />
            was the one
            <br />
            <span className="text-grey-400">we didn&rsquo;t make.</span>
          </Display>
        </Reveal>
        <Reveal delayMs={100}>
          <div
            aria-hidden
            className="mt-[clamp(40px,5vw,72px)] grid max-w-[720px] grid-cols-[auto_1fr_auto_auto_1fr_auto] items-center gap-3.5 text-[13px]"
          >
            <span>AI</span>
            <span className="h-0.5 bg-ink" />
            <span className="h-14 w-0.5 bg-ink" />
            <StopMark className="-ml-2" />
            <span className="h-0 border-t border-dashed border-grey-250" />
            <span className="text-grey-400">Real tool</span>
          </div>
          <div className="mt-[clamp(40px,5vw,72px)] flex flex-wrap gap-3">
            <PrimaryLink href={DASHBOARD}>Enter the Control Room →</PrimaryLink>
            <SecondaryLink href={DASHBOARD_ATTACK}>Replay the attack</SecondaryLink>
          </div>
        </Reveal>
        <footer className="mt-[clamp(72px,9vw,140px)] flex flex-wrap justify-between gap-4 border-t border-grey-200 pt-5 text-[13px] text-grey-500">
          <span className="flex items-center gap-2.5 text-ink">
            <span aria-hidden className="block h-3.5 w-0.5 bg-ink" />
            PromptFence
          </span>
          <span>AI can reason. PromptFence decides.</span>
          <span>Cedar · DynamoDB · EventBridge</span>
        </footer>
      </div>
    </section>
  );
}
