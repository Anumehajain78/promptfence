import { inr } from "./format";

export type Decision = "ALLOW" | "DENY" | "APPROVAL";

export type PolicyId =
  | "allow-support-refund-small"
  | "hold-support-refund-large"
  | "cumulative-refund-ceiling-v1"
  | "forbid-support-delete"
  | "allow-finance-refund"
  | "forbid-intern-export"
  | "no-matching-policy";

export const AGENTS = ["support-agent", "finance-agent", "intern-agent"] as const;
export const ACTIONS = ["refund", "delete_customer", "export_customer_data"] as const;
export const REFUND_CEILING = 355000;

// --- Shapes: match backend/src/authorize/app.py exactly --------------------

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
  policy: PolicyId;
  // The session's running refund total BEFORE this request.
  session_total: number;
  // 355000 for refund actions, otherwise null.
  ceiling: number | null;
  // null when the backend runs without its ledger tables.
  seq: number | null;
  ts: string;
}

export interface AttackRunRequest {
  agent?: string;
  session?: string;
  count?: number;
  amount?: number;
}

export interface AttackRunResult {
  seq: number | null;
  decision: Decision;
  policy: PolicyId;
  session_total_after: number;
}

export interface AttackRunResponse {
  session_id: string;
  results: AttackRunResult[];
  first_denied_seq: number | null;
}

// One item of GET /v1/sessions/{id} → decisions.
export interface DecisionRecord {
  session_id: string;
  seq: number | null;
  agent: string;
  action: string;
  resource: string;
  amount: number;
  decision: Decision;
  policy: PolicyId;
  reason: string;
  session_total_before: number;
  session_total_after: number;
  ts: string;
}

// One tool the agent tried to use. Mirrors backend/src/agent/app.py.
export interface AgentToolCall {
  tool: string;
  args: Record<string, string | number>;
  decision: Decision;
  policy: PolicyId | string;
  reason: string;
  executed: boolean;
}

export interface AgentChatRequest {
  session: string;
  message: string;
}

export interface AgentChatResponse {
  session: string;
  reply: string;
  tool_calls: AgentToolCall[];
}

export interface SessionResponse {
  session_id: string;
  agent: string;
  running_refund_total: number;
  ceiling: number;
  allowed: number;
  held: number;
  denied: number;
  decisions: DecisionRecord[];
}

// Any non-2xx. message is the API's {error} verbatim when it sent one.
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

// --- Real client -------------------------------------------------------------

async function request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  if (!API_BASE) {
    throw new ApiError(0, "NEXT_PUBLIC_API_BASE is not set. Set it, or set NEXT_PUBLIC_USE_MOCK=true.");
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, `Could not reach the API at ${API_BASE}.`);
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON response; handled below.
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed with status ${res.status}.`;
    throw new ApiError(res.status, message);
  }
  return payload as T;
}

const sessionPath = (id: string) => `/v1/sessions/${encodeURIComponent(id)}`;

export function authorize(req: AuthorizeRequest): Promise<AuthorizeResponse> {
  return USE_MOCK ? mockAuthorize(req) : request("POST", "/v1/authorize", req);
}

// The real endpoint returns every result at once; the UI paces the reveal.
export function attackRun(req: AttackRunRequest = {}): Promise<AttackRunResponse> {
  return request("POST", "/v1/attack-run", req);
}

export function getSession(id: string): Promise<SessionResponse> {
  return USE_MOCK ? mockGetSession(id) : request("GET", sessionPath(id));
}

export function resetSession(id: string): Promise<void> {
  return USE_MOCK ? mockResetSession(id) : request("DELETE", sessionPath(id));
}

// The real path runs a Bedrock turn: expect roughly 5–12 seconds.
export function agentChat(req: AgentChatRequest): Promise<AgentChatResponse> {
  return USE_MOCK ? mockAgentChat(req) : request("POST", "/v1/agent/chat", req);
}

// ---------------------------------------------------------------------------
// Mock: a local mirror of backend/policies/*.cedar and the handler's contract,
// including the session ledger. Same validation messages, policy ids, reasons
// and response shapes. The real decision always comes from Cedar.
// ---------------------------------------------------------------------------

type Role = "support" | "finance" | "intern";

const MOCK_AGENT_ROLES: Record<string, Role> = {
  "support-agent": "support",
  "finance-agent": "finance",
  "intern-agent": "intern",
};

const REQUIRED_STRING_FIELDS = ["agent", "session", "action", "resource"] as const;
const MAX_AMOUNT = 1_000_000_000_000;
const ATTACK_RUN_MAX_COUNT = 100;
const MOCK_LATENCY_MS = 150;
const MOCK_AGENT_LATENCY_MS = 1200;
const MOCK_ATTACK_INTERVAL_MS = 120;

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

interface MockSession {
  agent_id: string;
  seq: number;
  running_refund_total: number;
  allowed: number;
  held: number;
  denied: number;
  decisions: DecisionRecord[];
}

const mockSessions = new Map<string, MockSession>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function badRequest(message: string): never {
  throw new ApiError(400, message);
}

function nowIso(): string {
  return new Date().toISOString();
}

// Same checks, order and messages as validate() + validate_for_cedar() + unknown agent in app.py.
function validateMockRequest(req: AuthorizeRequest): Role {
  const body = req as unknown as Record<string, unknown>;

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
  if (!(ACTIONS as readonly string[]).includes(action)) {
    badRequest(`Unknown action '${action}'. Supported actions: ${ACTIONS.join(", ")}.`);
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

// Synchronous core shared by mockAuthorize and mockAttackRun. Records the decision.
function mockDecide(req: AuthorizeRequest): DecisionRecord {
  const role = validateMockRequest(req);
  const { session, action } = req;
  const amount = req.amount ?? 0;
  const ledger = mockSessions.get(session);
  const context: MockContext = { role, action, amount, session_total: ledger?.running_refund_total ?? 0 };

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

  const refundAdded = decision === "ALLOW" && action === "refund" ? amount : 0;
  const s: MockSession = ledger ?? {
    agent_id: req.agent,
    seq: 0,
    running_refund_total: 0,
    allowed: 0,
    held: 0,
    denied: 0,
    decisions: [],
  };
  s.seq += 1;
  s.running_refund_total += refundAdded;
  if (decision === "ALLOW") s.allowed += 1;
  else if (decision === "APPROVAL") s.held += 1;
  else s.denied += 1;

  const record: DecisionRecord = {
    session_id: session,
    seq: s.seq,
    agent: req.agent,
    action,
    resource: req.resource,
    amount,
    decision,
    policy,
    reason,
    session_total_before: context.session_total,
    session_total_after: context.session_total + refundAdded,
    ts: nowIso(),
  };
  s.decisions.push(record);
  mockSessions.set(session, s);
  return record;
}

export async function mockAuthorize(req: AuthorizeRequest): Promise<AuthorizeResponse> {
  // Simulated latency so loading states are visible while building the UI.
  await sleep(MOCK_LATENCY_MS);
  const r = mockDecide(req);
  return {
    decision: r.decision,
    reason: r.reason,
    policy: r.policy,
    session_total: r.session_total_before,
    ceiling: r.action === "refund" ? REFUND_CEILING : null,
    seq: r.seq,
    ts: r.ts,
  };
}

function randomHex(bytes: number): string {
  return Array.from({ length: bytes * 2 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

// Yields one decision at a time (~120ms apart) so the UI can animate rows
// arriving. Each item is a full DecisionRecord, which includes every
// AttackRunResult field. Stops after the first DENY, like the backend.
export async function* mockAttackRun({
  agent = "support-agent",
  session = `attack-${randomHex(4)}`,
  count = 40,
  amount = 9000,
}: AttackRunRequest = {}): AsyncGenerator<DecisionRecord> {
  if (typeof count !== "number" || !Number.isInteger(count)) badRequest("Field 'count' must be a whole number, e.g. 40.");
  if (count < 1) badRequest("Field 'count' must be at least 1.");
  if (count > ATTACK_RUN_MAX_COUNT) badRequest(`Field 'count' must not exceed ${ATTACK_RUN_MAX_COUNT}.`);

  for (let i = 1; i <= count; i++) {
    await sleep(MOCK_ATTACK_INTERVAL_MS);
    const record = mockDecide({ agent, session, action: "refund", resource: `order-${4400 + i}`, amount });
    yield record;
    if (record.decision === "DENY") return;
  }
}

const MOCK_ORDERS: Record<string, { amount: number; status: string; customer: string }> = {
  "ORD-1001": { amount: 9000, status: "delivered", customer: "#CUST-4474" },
  "ORD-1002": { amount: 42000, status: "delivered", customer: "#CUST-4474" },
  "ORD-1003": { amount: 5000, status: "shipped", customer: "#CUST-5120" },
  "ORD-1004": { amount: 1500, status: "delivered", customer: "#CUST-6033" },
  "ORD-1005": { amount: 120000, status: "cancelled", customer: "#CUST-7781" },
};

// Enough parsing to drive the demo: an order id, an amount, and whether this
// reads like a refund request. The real agent uses the model for this.
function readIntent(message: string) {
  const orderMatch = message.match(/ord-\s?(\d{4})/i);
  // Remove the order id first, or "ORD-1001" would be read as the amount.
  const rest = message.replace(/ord-\s?\d{4}/gi, " ").replace(/,/g, "").toLowerCase();
  const amountMatch =
    rest.match(/₹\s*(\d+)/) || rest.match(/(\d+)\s*(?:rupees|rupee|rs\b|inr)/) || rest.match(/\b(\d{3,})\b/);
  return {
    orderId: orderMatch ? `ORD-${orderMatch[1]}` : null,
    amount: amountMatch ? Number(amountMatch[1]) : null,
    isRefund: /refund|money back|return my/.test(message.toLowerCase()),
  };
}

export async function mockAgentChat({ session, message }: AgentChatRequest): Promise<AgentChatResponse> {
  // The real turn takes 5–12s; enough here to show the thinking state.
  await sleep(MOCK_AGENT_LATENCY_MS);

  const { orderId, amount, isRefund } = readIntent(message);

  if (!isRefund) {
    const order = orderId ? MOCK_ORDERS[orderId] : undefined;
    const reply = order
      ? `Order ${orderId} is ${order.status}. It is for ${inr(order.amount)}, customer ${order.customer}. No refund has been requested on it.`
      : "I can look up an order or issue a refund. Which order id should I check? The ones I have are ORD-1001 to ORD-1005.";
    return { session, reply, tool_calls: [] };
  }

  if (!orderId || amount === null) {
    return {
      session,
      reply: "I can do that — which order id, and how much should I refund? I never guess an order id.",
      tool_calls: [],
    };
  }

  // The governed tool: same decision path and same ledger as every other call.
  const record = mockDecide({ agent: "support-agent", session, action: "refund", resource: orderId, amount });
  const executed = record.decision === "ALLOW";
  const call: AgentToolCall = {
    tool: "refund_order",
    args: { order_id: orderId, amount },
    decision: record.decision,
    policy: record.policy,
    reason: record.reason,
    executed,
  };

  const reply =
    record.decision === "ALLOW"
      ? `Done — I've refunded ${inr(amount)} on ${orderId}. It should reach the original payment method in 3–5 working days.`
      : record.decision === "APPROVAL"
        ? `A refund of ${inr(amount)} on ${orderId} is above what I can approve alone, so I've held it as request #${record.seq} for a human to confirm. Nothing has been paid out yet.`
        : `I can't refund ${inr(amount)} on ${orderId}. PromptFence blocked it under ${record.policy}: ${record.reason} The tool was not called.`;

  return { session, reply, tool_calls: [call] };
}

export async function mockGetSession(id: string): Promise<SessionResponse> {
  await sleep(MOCK_LATENCY_MS);
  const s = mockSessions.get(id);
  if (!s) throw new ApiError(404, `Session '${id}' not found.`);
  return {
    session_id: id,
    agent: s.agent_id,
    running_refund_total: s.running_refund_total,
    ceiling: REFUND_CEILING,
    allowed: s.allowed,
    held: s.held,
    denied: s.denied,
    decisions: s.decisions.map((d) => ({ ...d })),
  };
}

export async function mockResetSession(id: string): Promise<void> {
  await sleep(MOCK_LATENCY_MS);
  mockSessions.delete(id);
}
