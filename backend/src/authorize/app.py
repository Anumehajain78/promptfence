"""POST /v1/authorize — decision from Cedar (cedarpy), using the request and
the session's running refund total.

Flow: validate body → resolve agent role → resolve session_total
      → cedarpy.is_authorized → map Cedar result to ALLOW / APPROVAL / DENY.

Writing the decision to DynamoDB and emitting to EventBridge come next.
"""

import base64
import json
import logging
import math
import os
from pathlib import Path

import cedarpy

logger = logging.getLogger("promptfence.authorize")
logger.setLevel(logging.INFO)

REQUIRED_STRING_FIELDS = ("agent", "session", "action", "resource")

# Must match the actions declared in policies/schema.cedarschema
# (tests/test_policies.py checks this).
KNOWN_ACTIONS = ("refund", "delete_customer", "export_customer_data")

# Used only when the agents table is unset or unreachable. Local dev and tests.
FALLBACK_AGENT_ROLES = {
    "support-agent": "support",
    "finance-agent": "finance",
    "intern-agent": "intern",
}

# Display only — returned so the UI can draw the ceiling. Cedar enforces it
# (policies/cumulative-refund-ceiling-v1.cedar); keep the two in sync.
REFUND_CEILING = 50000

# Cedar Long is 64-bit and `session_total + amount` must not overflow: a Cedar
# evaluation error makes that forbid policy silently not apply. Cap well below.
MAX_AMOUNT = 1_000_000_000_000

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
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
    return Path(__file__).resolve().parents[2] / "policies"  # repo layout


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
# Ledger lookups. DynamoDB when configured and reachable, else fallbacks.
# ---------------------------------------------------------------------------

_dynamodb = None


def _table(name):
    global _dynamodb
    if _dynamodb is None:
        import boto3  # present in the Lambda runtime; not needed for local tests
        from botocore.config import Config

        _dynamodb = boto3.resource(
            "dynamodb",
            config=Config(connect_timeout=1, read_timeout=2, retries={"max_attempts": 1}),
        )
    return _dynamodb.Table(name)


def resolve_role(agent_id):
    """Returns the agent's role, or None if the agent is unknown."""
    table_name = os.environ.get("AGENTS_TABLE")
    if table_name:
        try:
            item = _table(table_name).get_item(Key={"agent_id": agent_id}).get("Item")
            if item and item.get("role"):
                logger.info("role source=dynamodb agent=%s", agent_id)
                return str(item["role"])
            # Reachable but not seeded: fall back so the demo works before
            # seeding. Alternative: treat as unknown agent (stricter).
            logger.info("role source=fallback agent=%s (not in agents table)", agent_id)
        except Exception as err:
            logger.warning("role source=fallback agent=%s (agents table unreachable: %s)",
                           agent_id, type(err).__name__)
    else:
        logger.info("role source=fallback agent=%s (AGENTS_TABLE not set)", agent_id)
    return FALLBACK_AGENT_ROLES.get(agent_id)


def resolve_session_total(session_id):
    if os.environ.get("RUNNING_TESTS") == "1" and os.environ.get("SESSION_TOTAL_OVERRIDE"):
        logger.info("session_total source=test-override session=%s", session_id)
        return int(os.environ["SESSION_TOTAL_OVERRIDE"])

    table_name = os.environ.get("SESSIONS_TABLE")
    if table_name:
        try:
            item = _table(table_name).get_item(Key={"session_id": session_id}).get("Item") or {}
            logger.info("session_total source=dynamodb session=%s", session_id)
            return int(item.get("running_refund_total", 0))
        except Exception as err:
            logger.warning("session_total source=fallback session=%s (sessions table unreachable: %s)",
                           session_id, type(err).__name__)
    else:
        logger.info("session_total source=fallback session=%s (SESSIONS_TABLE not set)", session_id)
    return 0


# ---------------------------------------------------------------------------
# Request handling
# ---------------------------------------------------------------------------

def _response(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", **CORS_HEADERS},
        "body": json.dumps(body, ensure_ascii=False),
    }


def _is_number(value):
    # bool is a subclass of int in Python; "true" is not an amount.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    return math.isfinite(value)


def parse_body(event):
    raw = event.get("body")
    if raw is None or raw == "":
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


def handler(event, context):
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    if method == "OPTIONS":
        return _response(204, {})

    try:
        body = parse_body(event)
        validate(body)
        validate_for_cedar(body)

        role = resolve_role(body["agent"])
        if role is None:
            raise ValidationError(f"Unknown agent '{body['agent']}'. Register the agent before calling authorize.")

        session_total = resolve_session_total(body["session"])
        cedar_context = {"amount": int(body.get("amount") or 0), "session_total": session_total}

        decision, policy, reason = decide(body["agent"], role, body["action"], body["resource"], cedar_context)
    except ValidationError as err:
        return _response(400, {"error": str(err)})
    except Exception:
        # Never leak a stack trace to the caller.
        logger.exception("authorize failed")
        return _response(500, {"error": "Internal error while authorizing the request."})

    logger.info("decision=%s policy=%s agent=%s session=%s action=%s",
                decision, policy, body["agent"], body["session"], body["action"])
    return _response(200, {
        "decision": decision,
        "reason": reason,
        "policy": policy,
        "session_total": session_total,
        "ceiling": REFUND_CEILING if body["action"] == "refund" else None,
    })
