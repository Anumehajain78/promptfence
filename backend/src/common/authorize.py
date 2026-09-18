"""PromptFence authorization: Cedar decision + session ledger.

Shared by both Lambdas — the API (src/authorize/app.py) and the agent
(src/agent/app.py), which calls authorize() in-process rather than over HTTP.

The API routes this module serves (HTTP API payload v2, dispatched on routeKey):
  POST   /v1/authorize        Cedar decision + session ledger
  GET    /v1/sessions/{id}    session counters and decision timeline
  POST   /v1/attack-run       the sequential-refund demo, in-process
  DELETE /v1/sessions/{id}    wipe a session so the demo can rerun

Authorize flow: validate body → resolve agent role → read session ledger
  → cedarpy.is_authorized → map to ALLOW / APPROVAL / DENY
  → record decision (DynamoDB transaction) → publish to EventBridge.

With SESSIONS_TABLE / DECISIONS_TABLE unset the handler runs stateless
(session_total 0, nothing recorded): local dev and the Cedar unit tests.
"""

import base64
import json
import logging
import math
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path

import cedarpy
from botocore.exceptions import BotoCoreError, ClientError

import ledger

logger = logging.getLogger("promptfence.authorize")
logger.setLevel(logging.INFO)

REQUIRED_STRING_FIELDS = ("agent", "session", "action", "resource")

# Must match the actions declared in policies/schema.cedarschema
# (tests/test_policies.py checks this).
KNOWN_ACTIONS = ("refund", "delete_customer", "export_customer_data")

# Used when AGENTS_TABLE is unset, or the agent is not in the table (so the
# demo works before `make seed`). Alternative: treat as unknown agent (stricter).
FALLBACK_AGENT_ROLES = {
    "support-agent": "support",
    "finance-agent": "finance",
    "intern-agent": "intern",
}

# Display only — returned so the UI can draw the ceiling. Cedar enforces it
# (policies/cumulative-refund-ceiling-v1.cedar); keep the two in sync.
REFUND_CEILING = 355000

# Cedar Long is 64-bit and `session_total + amount` must not overflow: a Cedar
# evaluation error makes that forbid policy silently not apply. Cap well below.
MAX_AMOUNT = 1_000_000_000_000

# Re-read and re-evaluate this many times if a concurrent request changed the session.
MAX_LEDGER_ATTEMPTS = 5

ATTACK_RUN_MAX_COUNT = 100

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
}


class ValidationError(Exception):
    pass


# ---------------------------------------------------------------------------
# Policies: loaded once per cold start.
# ---------------------------------------------------------------------------

def _policies_dir():
    if os.environ.get("POLICIES_DIR"):
        return Path(os.environ["POLICIES_DIR"])
    packaged = Path(__file__).resolve().parent / "policies"  # sam build layout
    if packaged.is_dir():
        return packaged
    return Path(__file__).resolve().parents[2] / "policies"  # repo layout (backend/policies)


def load_policies(policies_dir):
    """Returns (PolicySet, Schema, {policy @id: annotations dict})."""
    files = sorted(policies_dir.glob("*.cedar"))
    if not files:
        raise RuntimeError(f"No .cedar files found in {policies_dir}")
    text = "\n".join(f.read_text(encoding="utf-8") for f in files)

    annotations_by_id = {}
    for policy in json.loads(cedarpy.policies_to_json_str(text))["staticPolicies"].values():
        annotations = policy.get("annotations", {})
        policy_id = annotations.get("id")
        if not policy_id:
            raise RuntimeError("Every policy must carry an @id annotation.")
        if policy_id in annotations_by_id:
            raise RuntimeError(f"Duplicate policy @id: {policy_id}")
        annotations_by_id[policy_id] = annotations

    schema = cedarpy.Schema.from_str((policies_dir / "schema.cedarschema").read_text(encoding="utf-8"))
    return cedarpy.PolicySet.from_str(text), schema, annotations_by_id


POLICY_SET, SCHEMA, POLICY_ANNOTATIONS = load_policies(_policies_dir())


# ---------------------------------------------------------------------------
# Ledger lookups. DynamoDB when configured; errors propagate (→ 503) so a
# broken ledger can never silently reset a session total to 0.
# ---------------------------------------------------------------------------

def resolve_role(agent_id):
    """Returns the agent's role, or None if the agent is unknown."""
    if ledger.agents_table():
        item = ledger.get_agent(agent_id)
        if item and item.get("role"):
            logger.info("role source=dynamodb agent=%s", agent_id)
            return str(item["role"])
        logger.info("role source=fallback agent=%s (not in agents table)", agent_id)
    else:
        logger.info("role source=fallback agent=%s (AGENTS_TABLE not set)", agent_id)
    return FALLBACK_AGENT_ROLES.get(agent_id)


def read_session(session_id):
    """Returns (session_total, seq). seq 0 means the session does not exist yet."""
    if ledger.enabled():
        item = ledger.get_session(session_id) or {}
        logger.info("session_total source=dynamodb session=%s", session_id)
        return int(item.get("running_refund_total", 0)), int(item.get("seq", 0))

    if os.environ.get("RUNNING_TESTS") == "1" and os.environ.get("SESSION_TOTAL_OVERRIDE"):
        logger.info("session_total source=test-override session=%s", session_id)
        return int(os.environ["SESSION_TOTAL_OVERRIDE"]), 0
    logger.info("session_total source=fallback session=%s (ledger tables not set)", session_id)
    return 0, 0


# ---------------------------------------------------------------------------
# Request handling
# ---------------------------------------------------------------------------

class NotFound(Exception):
    pass


class ServiceUnavailable(Exception):
    pass


def json_response(status, body):
    if body is None:
        return {"statusCode": status, "headers": dict(CORS_HEADERS), "body": ""}
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", **CORS_HEADERS},
        "body": json.dumps(body, ensure_ascii=False),
    }


# Internal alias kept so the rest of this module reads unchanged.
_response = json_response


def _is_number(value):
    # bool is a subclass of int in Python; "true" is not an amount.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    return math.isfinite(value)


def parse_body(event, required=True):
    raw = event.get("body")
    if raw is None or raw == "":
        if not required:
            return {}
        raise ValidationError("Request body is required and must be a JSON object.")
    if event.get("isBase64Encoded"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            raise ValidationError("Request body could not be decoded.")
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        raise ValidationError("Request body is not valid JSON.")
    if not isinstance(body, dict):
        raise ValidationError("Request body must be a JSON object.")
    return body


def validate(body):
    missing = [f for f in REQUIRED_STRING_FIELDS if f not in body or body[f] is None]
    if missing:
        raise ValidationError(f"Missing required field(s): {', '.join(missing)}.")

    for field in REQUIRED_STRING_FIELDS:
        value = body[field]
        if not isinstance(value, str) or not value.strip():
            raise ValidationError(f"Field '{field}' must be a non-empty string.")

    if body["action"] == "refund":
        if "amount" not in body or body["amount"] is None:
            raise ValidationError("Field 'amount' is required when action is 'refund'.")
    if "amount" in body and body["amount"] is not None:
        amount = body["amount"]
        if not _is_number(amount):
            raise ValidationError("Field 'amount' must be a number, e.g. 9000.")
        if amount < 0:
            raise ValidationError("Field 'amount' must not be negative.")


def validate_for_cedar(body):
    """Checks Cedar needs on top of validate(): known action, whole-rupee amount."""
    if body["action"] not in KNOWN_ACTIONS:
        raise ValidationError(
            f"Unknown action '{body['action']}'. Supported actions: {', '.join(KNOWN_ACTIONS)}."
        )
    amount = body.get("amount")
    if amount is not None:
        if float(amount) != int(amount):
            raise ValidationError("Field 'amount' must be a whole number of rupees, e.g. 9000.")
        if amount > MAX_AMOUNT:
            raise ValidationError(f"Field 'amount' must not exceed {MAX_AMOUNT}.")


def _inr(value):
    """Indian digit grouping: 100000 → ₹1,00,000."""
    digits = str(int(value))
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        digits = ",".join(groups + [tail])
    return f"₹{digits}"


REASONS = {
    "allow-support-refund-small":
        lambda c: f"Refund of {_inr(c['amount'])} is within the ₹10,000 per-call limit for support agents.",
    "hold-support-refund-large":
        lambda c: f"Refund of {_inr(c['amount'])} exceeds the ₹10,000 per-call limit; a human must approve it.",
    "cumulative-refund-ceiling-v1":
        lambda c: (f"Session refunds would reach {_inr(c['session_total'] + c['amount'])}, "
                   f"above the {_inr(REFUND_CEILING)} session ceiling."),
    "forbid-support-delete":
        lambda c: "Support agents may not delete customers.",
    "allow-finance-refund":
        lambda c: f"Refund of {_inr(c['amount'])} is within the ₹1,00,000 per-call limit for finance agents.",
    "forbid-intern-export":
        lambda c: "Intern agents may not export customer data.",
}


def _reason(policy_id, context):
    build = REASONS.get(policy_id)
    return build(context) if build else f"Decided by policy {policy_id}."


def decide(agent, role, action, resource, context):
    """Evaluates the request with Cedar and maps the result to a PromptFence decision.

    Cedar only answers Allow or Deny, and it applies its own rules (any forbid
    beats any permit; no matching permit means Deny). We map its answer:
      - Deny (a forbid matched, or no permit matched)        → DENY
      - Allow, determined by a policy with @decision("APPROVAL") → APPROVAL
      - Allow, any other determining permit                  → ALLOW
    Python never decides allow vs deny; it only labels Cedar's Allow.
    """
    result = cedarpy.is_authorized(
        {
            "principal": {"type": "Agent", "id": agent},
            "action": {"type": "Action", "id": action},
            "resource": {"type": "Order", "id": resource},
            "context": context,
        },
        POLICY_SET,
        [{"uid": {"type": "Agent", "id": agent}, "attrs": {"role": role}, "parents": []}],
        schema=SCHEMA,
    )
    if result.diagnostics.errors:
        logger.warning("cedar diagnostics errors: %s", result.diagnostics.errors)

    determining = sorted(result.diagnostics.id_annotations_by_reason.values())

    if result.decision == cedarpy.Decision.Allow:
        approval = [p for p in determining if POLICY_ANNOTATIONS[p].get("decision") == "APPROVAL"]
        if approval:
            return "APPROVAL", approval[0], _reason(approval[0], context)
        return "ALLOW", determining[0], _reason(determining[0], context)

    if result.decision == cedarpy.Decision.Deny and determining:
        return "DENY", determining[0], _reason(determining[0], context)

    if result.decision == cedarpy.Decision.NoDecision:
        # Request failed schema validation inside Cedar. Fail closed.
        return "DENY", "no-matching-policy", "The request could not be evaluated, so it is denied."

    return "DENY", "no-matching-policy", f"No policy permits {role} agents to {action.replace('_', ' ')}."


def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def authorize(body):
    """Validates, decides with Cedar, records, publishes. Returns the decision record.

    Raises ValidationError (400). DynamoDB errors propagate (503).
    """
    validate(body)
    validate_for_cedar(body)

    agent, session_id, action, resource = body["agent"], body["session"], body["action"], body["resource"]
    role = resolve_role(agent)
    if role is None:
        raise ValidationError(f"Unknown agent '{agent}'. Register the agent before calling authorize.")
    amount = int(body.get("amount") or 0)

    for attempt in range(1, MAX_LEDGER_ATTEMPTS + 1):
        session_total, seq = read_session(session_id)
        cedar_context = {"amount": amount, "session_total": session_total}
        decision, policy, reason = decide(agent, role, action, resource, cedar_context)

        refund_added = amount if decision == "ALLOW" and action == "refund" else 0
        record = {
            "session_id": session_id,
            "seq": seq + 1 if ledger.enabled() else None,
            "agent": agent,
            "action": action,
            "resource": resource,
            "amount": amount,
            "decision": decision,
            "policy": policy,
            "reason": reason,
            "session_total_before": session_total,
            "session_total_after": session_total + refund_added,
            "ts": _now_iso(),
        }
        if not ledger.enabled():
            break
        try:
            ledger.record_decision(record, expected_seq=seq, refund_added=refund_added)
            break
        except ledger.LedgerConflict:
            logger.warning("ledger conflict session=%s attempt=%d; re-evaluating", session_id, attempt)
    else:
        raise ServiceUnavailable("The session is receiving concurrent requests; please retry.")

    logger.info("decision=%s policy=%s agent=%s session=%s seq=%s action=%s",
                decision, policy, agent, session_id, record["seq"], action)
    ledger.publish_decision(record)
    return record


def _authorize_response(record):
    return {
        "decision": record["decision"],
        "reason": record["reason"],
        "policy": record["policy"],
        "session_total": record["session_total_before"],
        "ceiling": REFUND_CEILING if record["action"] == "refund" else None,
        "seq": record["seq"],
        "ts": record["ts"],
    }


def _require_ledger():
    if not ledger.enabled():
        raise ServiceUnavailable("Session storage is not configured (SESSIONS_TABLE / DECISIONS_TABLE unset).")


def _session_id(event):
    session_id = (event.get("pathParameters") or {}).get("id", "")
    if not session_id.strip():
        raise ValidationError("Session id is required in the path, e.g. /v1/sessions/demo-1.")
    return session_id


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def route_authorize(event):
    return 200, _authorize_response(authorize(parse_body(event)))


def route_get_session(event):
    _require_ledger()
    session_id = _session_id(event)
    session = ledger.get_session(session_id)
    if session is None:
        raise NotFound(f"Session '{session_id}' not found.")
    return 200, {
        "session_id": session_id,
        "agent": session.get("agent_id"),
        "running_refund_total": session.get("running_refund_total", 0),
        "ceiling": REFUND_CEILING,
        "allowed": session.get("allowed", 0),
        "held": session.get("held", 0),
        "denied": session.get("denied", 0),
        "decisions": ledger.list_decisions(session_id),
    }


def route_delete_session(event):
    _require_ledger()
    ledger.delete_session(_session_id(event))
    return 204, None


def route_attack_run(event):
    body = parse_body(event, required=False)
    agent = body.get("agent", "support-agent")
    session_id = body.get("session") or f"attack-{secrets.token_hex(4)}"
    count = body.get("count", 40)
    amount = body.get("amount", 9000)

    if isinstance(count, bool) or not isinstance(count, int):
        raise ValidationError("Field 'count' must be a whole number, e.g. 40.")
    if count < 1:
        raise ValidationError("Field 'count' must be at least 1.")
    if count > ATTACK_RUN_MAX_COUNT:
        raise ValidationError(f"Field 'count' must not exceed {ATTACK_RUN_MAX_COUNT}.")

    results, first_denied_seq = [], None
    for i in range(1, count + 1):
        record = authorize({
            "agent": agent,
            "session": session_id,
            "action": "refund",
            "resource": f"order-{4400 + i}",
            "amount": amount,
        })
        results.append({
            "seq": record["seq"],
            "decision": record["decision"],
            "policy": record["policy"],
            "session_total_after": record["session_total_after"],
        })
        if record["decision"] == "DENY":
            # Stop at the first block so the demo shows exactly one red row.
            first_denied_seq = record["seq"]
            break

    return 200, {"session_id": session_id, "results": results, "first_denied_seq": first_denied_seq}


ROUTES = {
    "POST /v1/authorize": route_authorize,
    "GET /v1/sessions/{id}": route_get_session,
    "DELETE /v1/sessions/{id}": route_delete_session,
    "POST /v1/attack-run": route_attack_run,
}


def handler(event, context):
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    if method == "OPTIONS":
        return _response(204, None)

    route_key = event.get("routeKey", "")
    route = ROUTES.get(route_key)
    if route is None:
        return _response(404, {"error": f"No route for '{route_key or method}'."})

    try:
        status, body = route(event)
    except ValidationError as err:
        return _response(400, {"error": str(err)})
    except NotFound as err:
        return _response(404, {"error": str(err)})
    except ServiceUnavailable as err:
        return _response(503, {"error": str(err)})
    except (BotoCoreError, ClientError):
        logger.exception("ledger unavailable route=%s", route_key)
        return _response(503, {"error": "The decision ledger is unavailable, so nothing was authorized. Please retry."})
    except Exception:
        # Never leak a stack trace to the caller.
        logger.exception("request failed route=%s", route_key)
        return _response(500, {"error": "Internal error while handling the request."})
    return _response(status, body)
