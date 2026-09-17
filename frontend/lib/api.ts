export type Decision = "ALLOW" | "DENY" | "APPROVAL";

export type PolicyId =
  | "allow-support-refund-small"
  | "hold-support-refund-large"
  | "cumulative-refund-ceiling-v1"
  | "forbid-support-delete"
  | "allow-finance-refund"
  | "forbid-intern-export"
  | "no-matching-policy";

export interface AuthorizeRequest {
  agent: string;
  session: string;
  action: string;
  resource: string;
  amount?: number;
}

// Matches backend/src/authorize/app.py exactly.
export interface AuthorizeResponse {
  decision: Decision;
  reason: string;
  policy: PolicyId;
  // The session's running refund total BEFORE this request.
  session_total: number;
  // 50000 for refund actions, otherwise null.
  ceiling: number | null;
}

// Thrown for any non-2xx response. status 400 carries the backend's readable message.
export class AuthorizeError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthorizeError";
    this.status = status;
  }
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
    throw new AuthorizeError(res.status, message);
  }

  return body as AuthorizeResponse;
}

// ---------------------------------------------------------------------------
// Mock: a local mirror of backend/policies/*.cedar and the handler's contract,
// for building UI without the backend. Same validation messages, policy ids,
// reasons and response shape. The real decision always comes from Cedar.
// ---------------------------------------------------------------------------

type Role = "support" | "finance" | "intern";

const MOCK_AGENT_ROLES: Record<string, Role> = {
  "support-agent": "support",
  "finance-agent": "finance",
  "intern-agent": "intern",
};

const REQUIRED_STRING_FIELDS = ["agent", "session", "action", "resource"] as const;
const KNOWN_ACTIONS = ["refund", "delete_customer", "export_customer_data"];
const REFUND_CEILING = 50000;
const MAX_AMOUNT = 1_000_000_000_000;

interface MockContext {
  role: Role;
  action: string;
  amount: number;
  session_total: number;
}

interface MockPolicy {
  id: Exclude<PolicyId, "no-matching-policy">;
  effect: "permit" | "forbid";
  matches: (c: MockContext) => boolean;
  reason: (c: MockContext) => string;
}

// Indian digit grouping: 100000 → ₹1,00,000 (same as backend _inr).
function inr(value: number): string {
  let digits = String(Math.trunc(value));
  if (digits.length > 3) {
    let head = digits.slice(0, -3);
    const tail = digits.slice(-3);
    const groups: string[] = [];
    while (head.length > 2) {
      groups.unshift(head.slice(-2));
      head = head.slice(0, -2);
    }
    if (head) groups.unshift(head);
    digits = [...groups, tail].join(",");
  }
  return `₹${digits}`;
}

const MOCK_POLICIES: MockPolicy[] = [
  {
    id: "allow-support-refund-small",
    effect: "permit",
    matches: (c) => c.action === "refund" && c.role === "support" && c.amount <= 10000,
    reason: (c) => `Refund of ${inr(c.amount)} is within the ₹10,000 per-call limit for support agents.`,
  },
  {
    // The only APPROVAL policy (@decision("APPROVAL") in Cedar).
    id: "hold-support-refund-large",
    effect: "permit",
    matches: (c) => c.action === "refund" && c.role === "support" && c.amount > 10000,
    reason: (c) => `Refund of ${inr(c.amount)} exceeds the ₹10,000 per-call limit; a human must approve it.`,
  },
  {
    id: "cumulative-refund-ceiling-v1",
    effect: "forbid",
    matches: (c) =>
      c.action === "refund" && c.role === "support" && c.session_total + c.amount > REFUND_CEILING,
    reason: (c) =>
      `Session refunds would reach ${inr(c.session_total + c.amount)}, above the ${inr(REFUND_CEILING)} session ceiling.`,
  },
  {
    id: "forbid-support-delete",
    effect: "forbid",
    matches: (c) => c.action === "delete_customer" && c.role === "support",
    reason: () => "Support agents may not delete customers.",
  },
  {
    id: "allow-finance-refund",
    effect: "permit",
    matches: (c) => c.action === "refund" && c.role === "finance" && c.amount <= 100000,
    reason: (c) => `Refund of ${inr(c.amount)} is within the ₹1,00,000 per-call limit for finance agents.`,
  },
  {
    id: "forbid-intern-export",
    effect: "forbid",
    matches: (c) => c.action === "export_customer_data" && c.role === "intern",
    reason: () => "Intern agents may not export customer data.",
  },
];

// session id → running refund total. Only ALLOWed refunds count; APPROVAL
// does not add until a human approves. (Backend ledger writes: next branch.)
const sessionTotals = new Map<string, number>();

export function getMockSessionTotal(session: string): number {
  return sessionTotals.get(session) ?? 0;
}

export function resetMockSessions(): void {
  sessionTotals.clear();
}

function badRequest(message: string): never {
  throw new AuthorizeError(400, message);
}

// Same checks, order and messages as validate() + validate_for_cedar() + unknown agent in app.py.
function validateMockRequest(request: AuthorizeRequest): Role {
  const body = request as unknown as Record<string, unknown>;

  const missing = REQUIRED_STRING_FIELDS.filter((f) => body[f] === undefined || body[f] === null);
  if (missing.length) badRequest(`Missing required field(s): ${missing.join(", ")}.`);

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = body[field];
    if (typeof value !== "string" || !value.trim()) {
      badRequest(`Field '${field}' must be a non-empty string.`);
    }
  }

  const amount = body.amount;
  const hasAmount = amount !== undefined && amount !== null;
  if (body.action === "refund" && !hasAmount) {
    badRequest("Field 'amount' is required when action is 'refund'.");
  }
  if (hasAmount) {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      badRequest("Field 'amount' must be a number, e.g. 9000.");
    }
    if (amount < 0) badRequest("Field 'amount' must not be negative.");
  }

  const action = body.action as string;
  if (!KNOWN_ACTIONS.includes(action)) {
    badRequest(`Unknown action '${action}'. Supported actions: ${KNOWN_ACTIONS.join(", ")}.`);
  }
  if (hasAmount) {
    if (!Number.isInteger(amount)) {
      badRequest("Field 'amount' must be a whole number of rupees, e.g. 9000.");
    }
    if ((amount as number) > MAX_AMOUNT) badRequest(`Field 'amount' must not exceed ${MAX_AMOUNT}.`);
  }

  const agent = body.agent as string;
  const role = MOCK_AGENT_ROLES[agent];
  if (!role) badRequest(`Unknown agent '${agent}'. Register the agent before calling authorize.`);
  return role;
}

export async function mockAuthorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
  // Simulated latency so loading states are visible while building the UI.
  await new Promise((resolve) => setTimeout(resolve, 150));

  const role = validateMockRequest(request);
  const { session, action } = request;
  const context: MockContext = {
    role,
    action,
    amount: request.amount ?? 0,
    session_total: getMockSessionTotal(session),
  };

  const matched = MOCK_POLICIES.filter((p) => p.matches(context));
  const byId = (a: MockPolicy, b: MockPolicy) => (a.id < b.id ? -1 : 1);
  const forbids = matched.filter((p) => p.effect === "forbid").sort(byId);
  const permits = matched.filter((p) => p.effect === "permit").sort(byId);

  let decision: Decision;
  let policy: PolicyId;
  let reason: string;

  if (forbids.length) {
    // Any forbid beats any permit.
    [decision, policy, reason] = ["DENY", forbids[0].id, forbids[0].reason(context)];
  } else if (permits.length) {
    const hold = permits.find((p) => p.id === "hold-support-refund-large");
    const chosen = hold ?? permits[0];
    [decision, policy, reason] = [hold ? "APPROVAL" : "ALLOW", chosen.id, chosen.reason(context)];
  } else {
    // No matching permit: default deny.
    [decision, policy, reason] = [
      "DENY",
      "no-matching-policy",
      `No policy permits ${role} agents to ${action.replace(/_/g, " ")}.`,
    ];
  }

  if (decision === "ALLOW" && action === "refund") {
    sessionTotals.set(session, context.session_total + context.amount);
  }

  return {
    decision,
    reason,
    policy,
    session_total: context.session_total,
    ceiling: action === "refund" ? REFUND_CEILING : null,
  };
}
