export type Decision = "ALLOW" | "DENY" | "APPROVAL";

export interface AuthorizeRequest {
  agent: string;
  session: string;
  action: string;
  resource: string;
  amount?: number;
}

export interface AuthorizeResponse {
  decision: Decision;
  reason: string;
  policy: string;
  // Not returned by the backend skeleton yet; the mock fills it so the
  // dashboard's running total can be built. Backend should add it.
  session_total?: number;
}

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

export async function authorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
  if (USE_MOCK) return mockAuthorize(request);

  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_BASE is not set. Set it, or set NEXT_PUBLIC_USE_MOCK=true.");
  }

  const res = await fetch(`${API_BASE}/v1/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response; handled below.
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed with status ${res.status}.`;
    throw new Error(message);
  }

  return body as AuthorizeResponse;
}

// ---------------------------------------------------------------------------
// Mock: the six policies applied locally, for building UI before the backend.
// Mirrors Cedar semantics: default deny, and DENY > APPROVAL > ALLOW when
// several policies match. The real decision always comes from Cedar.
// ---------------------------------------------------------------------------

type Role = "support" | "finance" | "intern";

// Demo agent ids → role. An agent id that is itself a role name also works.
const MOCK_AGENT_ROLES: Record<string, Role> = {
  "support-bot": "support",
  "finance-bot": "finance",
  "intern-bot": "intern",
};

const PER_CALL_SUPPORT_LIMIT = 10_000;
const SESSION_SUPPORT_CEILING = 50_000;
const PER_CALL_FINANCE_LIMIT = 100_000;

// session id → running refund total (only ALLOWed refunds count).
const sessionTotals = new Map<string, number>();

function roleOf(agent: string): Role | undefined {
  if (agent in MOCK_AGENT_ROLES) return MOCK_AGENT_ROLES[agent];
  if (agent === "support" || agent === "finance" || agent === "intern") return agent;
  return undefined;
}

export function getMockSessionTotal(session: string): number {
  return sessionTotals.get(session) ?? 0;
}

export function resetMockSessions(): void {
  sessionTotals.clear();
}

export async function mockAuthorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
  // Simulated latency so loading states are visible while building the UI.
  await new Promise((resolve) => setTimeout(resolve, 150));

  const { agent, session, action } = request;
  if (!agent || !session || !action || !request.resource) {
    throw new Error("Missing required field(s): agent, session, action, resource.");
  }
  if (action === "refund" && (typeof request.amount !== "number" || !Number.isFinite(request.amount))) {
    throw new Error("Field 'amount' must be a number, e.g. 9000.");
  }

  const role = roleOf(agent);
  const amount = request.amount ?? 0;
  const total = getMockSessionTotal(session);

  const decide = (decision: Decision, policy: string, reason: string): AuthorizeResponse => {
    let sessionTotal = total;
    if (decision === "ALLOW" && action === "refund") {
      sessionTotal = total + amount;
      sessionTotals.set(session, sessionTotal);
    }
    return { decision, policy, reason, session_total: sessionTotal };
  };

  if (role === "support" && action === "refund") {
    if (total + amount > SESSION_SUPPORT_CEILING) {
      return decide(
        "DENY",
        "cumulative-refund-ceiling-v1",
        `Session refunds would reach ₹${total + amount}, above the ₹${SESSION_SUPPORT_CEILING} ceiling.`,
      );
    }
    if (amount > PER_CALL_SUPPORT_LIMIT) {
      return decide(
        "APPROVAL",
        "support-refund-approval-v1",
        `Refund of ₹${amount} exceeds the ₹${PER_CALL_SUPPORT_LIMIT} per-call limit; needs human approval.`,
      );
    }
    return decide("ALLOW", "support-refund-limit-v1", `Refund of ₹${amount} is within the per-call limit.`);
  }

  if (role === "support" && action === "delete_customer") {
    return decide("DENY", "support-delete-customer-v1", "Support agents may not delete customers.");
  }

  if (role === "finance" && action === "refund" && amount <= PER_CALL_FINANCE_LIMIT) {
    return decide("ALLOW", "finance-refund-limit-v1", `Refund of ₹${amount} is within the finance limit.`);
  }

  if (role === "intern" && action === "export_customer_data") {
    return decide("DENY", "intern-export-customer-data-v1", "Interns may not export customer data.");
  }

  return decide("DENY", "default-deny", "No policy permits this action.");
}
