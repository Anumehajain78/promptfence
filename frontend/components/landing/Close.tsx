import { Reveal } from "./Reveal";
import { DASHBOARD, DASHBOARD_ATTACK, Display, Kicker, PAGE_X, PrimaryLink, SecondaryLink, StopMark } from "./ui";

/**
 * The closing section, on black. It is as tall as the screen below the header and
 * sticks to the bottom of the viewport behind the light page (app/page.tsx), so
 * it is already in place, not moving, as the page's curly edge lifts off it. At
 * the end of the scroll that edge rests just under the header.
 *
 * The reveal only applies when the screen is tall enough to hold the whole
 * section; otherwise, and with prefers-reduced-motion, it is an ordinary section
 * that scrolls in under the same edge.
 */
export function Close() {
  return (
    <section
      aria-label="Close"
      className="pf-theme-lock relative z-0 flex min-h-[calc(100svh-96px)] flex-col justify-end bg-black text-paper md:min-h-[calc(100vh-62px)] [@media(min-height:660px)]:sticky [@media(min-height:660px)]:bottom-0 md:[@media(min-height:700px)]:sticky md:[@media(min-height:700px)]:bottom-0 motion-reduce:!static"
    >
      <div className={`mx-auto w-full max-w-[1440px] pb-[clamp(18px,2.2vw,32px)] pt-[clamp(56px,min(5vw,8vh),84px)] ${PAGE_X}`}>
        <Reveal>
          <Kicker onInk>The tool never ran</Kicker>
          <Display className="mt-[clamp(16px,min(3vw,3.4vh),40px)] text-[clamp(38px,min(7.6vw,11.5vh),124px)] font-normal leading-[0.92]">
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
            className="mt-[clamp(24px,min(3.4vw,5vh),56px)] grid max-w-[720px] grid-cols-[auto_1fr_auto_auto_1fr_auto] items-center gap-3.5 text-[13px]"
          >
            <span>AI</span>
            <span className="h-0.5 bg-paper" />
            <span className="h-14 w-0.5 bg-paper" />
            <StopMark className="-ml-2" />
            <span className="h-0 border-t border-dashed border-grey-500" />
            <span className="text-grey-400">Real tool</span>
          </div>
          <div className="mt-[clamp(24px,min(3.4vw,5vh),56px)] flex flex-wrap gap-3">
            <PrimaryLink href={DASHBOARD}>Enter the Control Room →</PrimaryLink>
            <SecondaryLink href={DASHBOARD_ATTACK} onInk>
              Replay the attack
            </SecondaryLink>
          </div>
        </Reveal>
        <footer className="mt-[clamp(28px,min(3.6vw,5.5vh),60px)] flex flex-wrap justify-between gap-4 border-t border-grey-700 pt-5 text-[13px] text-grey-400">
          <span className="flex items-center gap-2.5 text-paper">
            <span aria-hidden className="block h-3.5 w-0.5 bg-paper" />
            PromptFence
          </span>
          <span>AI can reason. PromptFence decides.</span>
          <span>Cedar · DynamoDB · EventBridge</span>
        </footer>
      </div>
    </section>
  );
}
