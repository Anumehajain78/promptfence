# PromptFence backend

CEDAR_MODE=cedarpy
BEDROCK_MODEL_ID=<fill>

## How a decision is made

`POST /v1/authorize` → validate body → resolve the agent's role → read the
session's `running_refund_total` → `cedarpy.is_authorized` against the six
policies in `policies/` (schema: `policies/schema.cedarschema`).

Cedar answers Allow or Deny. The handler labels it:

| Cedar result                                              | PromptFence |
|-----------------------------------------------------------|-------------|
| Deny (a forbid matched, or no permit matched)             | `DENY`      |
| Allow, determining policy has `@decision("APPROVAL")`     | `APPROVAL`  |
| Allow, any other permit                                   | `ALLOW`     |

Role and session total come from DynamoDB when `AGENTS_TABLE` / `SESSIONS_TABLE`
are set and reachable. Otherwise the role comes from a built-in map
(`support-agent`, `finance-agent`, `intern-agent`) and the session total is 0.
The logs say which path was used. This branch does not write to DynamoDB yet.

## Run tests (no AWS account needed)

```bash
make setup
make test
```

## Run the API locally

Needs the AWS SAM CLI and Docker.

```bash
make local
```

```bash
curl -s -X POST http://localhost:3001/v1/authorize \
  -H 'Content-Type: application/json' \
  -d '{"agent":"support-agent","session":"demo-1","action":"refund","resource":"order-42","amount":9000}'
```

Expected response:

```json
{"decision": "ALLOW", "reason": "Refund of ₹9,000 is within the ₹10,000 per-call limit for support agents.", "policy": "allow-support-refund-small", "session_total": 0, "ceiling": 50000}
```
