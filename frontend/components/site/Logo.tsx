/**
 * The PromptFence logo: the shield mark and the wordmark. One definition for the whole site, so the landing
 * page, its footer and the Control Room can never drift apart.
 *
 * The mark keeps its own colours wherever it sits (pf-theme-lock opts it out of the landing page's
 * light-to-dark fade): an ink tile with the lime shield, the brand's one accent. The hairline border is what
 * keeps the tile visible on black. The wordmark takes the colour of its surroundings.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-[18px] font-semibold leading-none tracking-[-0.03em] ${className}`}>
      <span className="pf-theme-lock grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-grey-700 bg-ink text-lime">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
          <path d="M12 2.8 4.5 5.6v6.1c0 4.6 3 7.9 7.5 9.5 4.5-1.6 7.5-4.9 7.5-9.5V5.6L12 2.8Z" />
          <path d="m9 12 2.2 2.2L15.2 10" />
        </svg>
      </span>
      PromptFence
    </span>
  );
}
