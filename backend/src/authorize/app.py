"""POST /v1/authorize — skeleton.

Validates the request body and returns a placeholder ALLOW. Cedar evaluation,
the session ledger (DynamoDB) and the EventBridge event come next.
"""

import base64
import json
import math
import os

AGENTS_TABLE = os.environ.get("AGENTS_TABLE", "")
SESSIONS_TABLE = os.environ.get("SESSIONS_TABLE", "")
DECISIONS_TABLE = os.environ.get("DECISIONS_TABLE", "")
EVENT_BUS_NAME = os.environ.get("EVENT_BUS_NAME", "")

REQUIRED_STRING_FIELDS = ("agent", "session", "action", "resource")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
}


class ValidationError(Exception):
    pass


def _response(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", **CORS_HEADERS},
        "body": json.dumps(body),
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


def handler(event, context):
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    if method == "OPTIONS":
        return _response(204, {})

    try:
        body = parse_body(event)
        validate(body)
    except ValidationError as err:
        return _response(400, {"error": str(err)})
    except Exception:
        # Never leak a stack trace to the caller.
        return _response(500, {"error": "Internal error while authorizing the request."})

    return _response(200, {"decision": "ALLOW", "reason": "skeleton", "policy": "none"})
