import Link from "next/link";

// Placeholder landing page. Real layout comes from ../design/ (PromptFence Landing).
export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="text-sm text-grey-500">A security control layer for AI agents</p>
      <h1 className="mt-4 text-6xl font-medium leading-none tracking-tight">
        AI can reason.
        <br />
        PromptFence decides.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-grey-700">
        Every action an agent wants to take is checked against Cedar policies and the session&rsquo;s
        ledger before it runs.
      </p>
      <div className="mt-10 border-t border-grey-200 pt-6">
        <Link href="/dashboard/" className="inline-flex h-9 items-center rounded border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-paper">
          Enter Control Room
        </Link>
      </div>
    </main>
  );
}
