# PromptFence — project context for Claude Code

## What this is
PromptFence is a permission gate for AI agents. Before an agent performs a real
action (e.g. issuing a refund), it calls our API. We evaluate the request against
Cedar policies AND against a per-session ledger of what the agent has already done,
then return ALLOW, DENY, or APPROVAL. Tagline: "AI can reason. PromptFence decides."

Built in 4 days (17–20 Sept 2026) for the First Commit hackathon (WeMakeDevs × AWS),
Ship It track. Two-person team. Deadline is hard: late = not scored.

## The one flow (everything else is optional)
customer message → Strands agent on Bedrock decides to call refund tool
→ agent POSTs /v1/authorize → Lambda reads session ledger from DynamoDB
→ Cedar evaluates policies with request + ledger context → decision
→ decision written to DynamoDB, event emitted to EventBridge
→ dashboard timeline shows the row

## The differentiator — do not lose this
Per-call checks have no memory. Our session ledger does. The demo's centrepiece:
40 sequential refunds of ₹9,000 (each under the ₹10,000 per-call limit, each
individually ALLOW) until the session total would exceed ₹50,000 → DENY.
Policy name: cumulative-refund-ceiling-v1.

## Non-negotiables
- The allow/deny decision MUST come from Cedar. Never an if-statement pretending.
- Every AWS service must have a visible job in the demo. No decorative services.
- Working > polished. One feature that runs beats five that almost do.
- Bad input returns a readable 400 with a clear message, never a 500 or stack trace.
- Slow operations (Bedrock, cold start) must have a visible loading state in the UI.

## Stack
- backend/: Python 3.11, AWS SAM. Lambda + API Gateway (HTTP API) + DynamoDB
  + EventBridge. Cedar via Amazon Verified Permissions (or cedarpy in Lambda —
  see backend/README.md for which was chosen). Strands Agents SDK + Bedrock for
  the sample agent. Region: ap-south-1 unless backend/README.md says otherwise.
- frontend/: Next.js 15 (App Router), TypeScript, Tailwind, static export
  (output: 'export'), deployed on Amplify Hosting from main.
  Fonts: Geist for readable text, Geist Mono only for values and identifiers.
  Sentence case throughout.
  Palette: paper #F7F8F4, ink #141413, greys #3B3E38 #6E726A #8A8E84 #A6AA9F
  #C2C5BC #D6D9CF #E6E8E0, allow #128A60/#18B981, lime #B8F227/#C9F94F,
  amber #9A6B00/#F3B83F, deny #D93636/#FF4D4D, clay #D97757.
  No gradients, no shadows, no rounded corners >2px, no icons.
- design/: reference exports from Claude Design. Match them; don't invent new UI.

## Data model (DynamoDB)
- agents:    PK agent_id. Holds api_key, role, display name.
- sessions:  PK session_id. Holds agent_id, running_refund_total, counts.
- decisions: PK session_id, SK seq (number). Holds action, resource, amount,
             decision, policy_id, reason, timestamp.

## API
- POST /v1/authorize   {agent, session, action, resource, amount} → decision
- GET  /v1/sessions/{id}   full decision timeline for a session
- POST /v1/attack-run  fires the 40-refund sequence through the agent
- POST /v1/approvals/{id}  (stretch) human approve/reject
Auth: Bearer API key per agent, looked up in the agents table. No user login.

## Policies (six, no more)
support refund ≤ 10000 → ALLOW; support refund > 10000 → APPROVAL;
support session refunds > 50000 → DENY; support delete_customer → DENY;
finance refund ≤ 100000 → ALLOW; intern export_customer_data → DENY.

## Explicitly out of scope — do not build
Cognito/login, OpenSearch, SDKs, multi-region, multi-tenant, more than one
dashboard screen, more than six policies.

## Git conventions
- main is always deployable. Work on backend/* or frontend/* branches. Squash-merge.
- Commit messages: "backend: ...", "frontend: ...", "policy: ...", "docs: ...".
- DO NOT create commits yourself. Stage changes and tell me what to commit;
  I commit manually. Never add Co-Authored-By, "Generated with", or
  Claude-Session trailers to any commit message.
- Never commit .env, AWS keys, samconfig.toml, or node_modules.

## Working style
- Ask before adding a dependency or a new AWS resource.
- Prefer the smallest change that makes the flow work end to end.
- When something is ambiguous, pick the option that ships today and note the
  alternative in a comment.
