# PromptFence backend

CEDAR_MODE=cedarpy
BEDROCK_MODEL_ID=<fill>

## How a decision is made

`POST /v1/authorize` → validate body → resolve the agent's role → read the
session ledger → `cedarpy.is_authorized` against the six policies in
`policies/` (schema: `policies/schema.cedarschema`) → record the decision →
publish it to EventBridge.

Cedar answers Allow or Deny. The handler labels it:

| Cedar result                                              | PromptFence |
|-----------------------------------------------------------|-------------|
| Deny (a forbid matched, or no permit matched)             | `DENY`      |
| Allow, determining policy has `@decision("APPROVAL")`     | `APPROVAL`  |
| Allow, any other permit                                   | `ALLOW`     |

## Session ledger

- **Session total:** `running_refund_total` grows only on ALLOW refunds.
  APPROVAL and DENY don't change it, but they still count in
  `allowed` / `held` / `denied`.
- **One transaction per decision:** the session item's `seq` and counters are
  bumped and the `decisions` item is written together. The session update is
  conditional on `seq` being unchanged since it was read. If a concurrent
  request got there first, the handler re-reads and re-evaluates with Cedar,
  so parallel requests can't overspend the ceiling.
- **Events:** each decision goes to `promptfence-bus` (source `promptfence`,
  detail-type = the decision). An EventBridge failure is logged and never
  changes the response.
- **Stateless mode:** with `SESSIONS_TABLE` / `DECISIONS_TABLE` unset, nothing
  is recorded (`session_total` 0, `seq` null) and `/v1/sessions` returns 503.
  If the tables are set but DynamoDB fails, requests return 503; they never
  fall back to a total of 0.
- **Roles:** they come from the `agents` table. An agent that isn't in the
  table (or `AGENTS_TABLE` unset) falls back to `support-agent`,
  `finance-agent` and `intern-agent`.

## API

| Route                        | Does                                                                |
|------------------------------|---------------------------------------------------------------------|
| `POST /v1/authorize`         | `{agent, session, action, resource, amount}` → `{decision, reason, policy, session_total, ceiling, seq, ts}` |
| `GET /v1/sessions/{id}`      | `{session_id, agent, running_refund_total, ceiling, allowed, held, denied, decisions[]}` (seq ascending), 404 if unknown |
| `POST /v1/attack-run`        | `{agent?, session?, count?, amount?}` (defaults support-agent, attack-xxxxxxxx, 40, 9000). Stops at the first DENY. → `{session_id, results[], first_denied_seq}` |
| `DELETE /v1/sessions/{id}`   | Deletes the session and its decisions. 204.                        |

Session ceiling: ₹3,55,000. With the defaults, refunds 1–39 are ALLOW
(39 × 9000 = 351000) and #40 is DENY (360000 > 355000).

## Run tests (no AWS account needed)

DynamoDB and EventBridge are mocked with moto.

```bash
make setup
make test
```

## Run the API locally

Needs the AWS SAM CLI and Docker. `local-env.json` blanks the table names, so
this runs stateless: Cedar decisions work, but nothing is recorded and
attack-run never reaches a DENY.

```bash
make local
```

```bash
curl -s -X POST http://localhost:3001/v1/authorize \
  -H 'Content-Type: application/json' \
  -d '{"agent":"support-agent","session":"demo-1","action":"refund","resource":"order-42","amount":9000}'
```

Expected response (`ts` will differ):

```json
{"decision": "ALLOW", "reason": "Refund of ₹9,000 is within the ₹10,000 per-call limit for support agents.", "policy": "allow-support-refund-small", "session_total": 0, "ceiling": 355000, "seq": null, "ts": "2026-09-18T10:00:00.000Z"}
```

## Against the deployed stack

```bash
make seed
```

```bash
curl -s -X POST "$API/v1/attack-run" -H 'Content-Type: application/json' -d '{"session":"demo-1"}'
```

```bash
curl -s "$API/v1/sessions/demo-1"
```

```bash
curl -s -X DELETE "$API/v1/sessions/demo-1"
```

`make seed` reads the table name from `AGENTS_TABLE`, or from the
`AgentsTableName` output of stack `promptfence` (override with
`STACK_NAME=...`). Re-running it rotates the API keys.
