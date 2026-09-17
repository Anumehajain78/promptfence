// Placeholder dashboard. Build first: session timeline + running total (see ../../CLAUDE.md).
export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-4xl">Session timeline</h1>
      <div className="mt-8 border border-rule bg-panel p-6">
        <p className="text-muted">No decisions yet.</p>
        <p className="mt-4 font-mono text-sm">
          running_refund_total <span className="text-ink">₹0</span>
        </p>
        <div className="mt-4 flex gap-6 font-mono text-sm">
          <span className="text-allow">ALLOW</span>
          <span className="text-hold">APPROVAL</span>
          <span className="text-deny">DENY</span>
        </div>
      </div>
      <pre className="mt-6 bg-terminal p-4 font-mono text-xs text-paper">
        POST /v1/authorize → waiting for first request
      </pre>
    </main>
  );
}
