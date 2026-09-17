import Link from "next/link";

// Placeholder landing page. Real layout comes from ../design/ exports.
export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">PromptFence</p>
      <h1 className="mt-4 font-display text-6xl leading-tight">
        AI can reason. <span className="text-accent">PromptFence decides.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted">
        A permission gate for AI agents. Every action is checked against Cedar policies and the
        session&rsquo;s ledger before it runs.
      </p>
      <div className="mt-10 border-t border-rule pt-6">
        <Link href="/dashboard" className="font-mono text-sm text-accent underline">
          Open dashboard
        </Link>
      </div>
    </main>
  );
}
