import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "authorize"))

import app  # noqa: E402


def call(body):
    event = {
        "requestContext": {"http": {"method": "POST"}},
        "body": body if isinstance(body, str) or body is None else json.dumps(body),
    }
    response = app.handler(event, None)
    return response["statusCode"], json.loads(response["body"]), response["headers"]


def valid_refund(**overrides):
    body = {
        "agent": "support-bot",
        "session": "sess-001",
        "action": "refund",
        "resource": "order-123",
        "amount": 9000,
    }
    body.update(overrides)
    return body


def test_valid_refund_returns_skeleton_allow():
    status, body, headers = call(valid_refund())
    assert status == 200
    assert body == {"decision": "ALLOW", "reason": "skeleton", "policy": "none"}
    assert headers["Access-Control-Allow-Origin"] == "*"


def test_valid_non_refund_without_amount():
    req = valid_refund(action="delete_customer")
    del req["amount"]
    status, body, _ = call(req)
    assert status == 200
    assert body["decision"] == "ALLOW"


@pytest.mark.parametrize("field", ["agent", "session", "action", "resource"])
def test_missing_required_field(field):
    req = valid_refund()
    del req[field]
    status, body, headers = call(req)
    assert status == 400
    assert field in body["error"]
    assert headers["Access-Control-Allow-Origin"] == "*"


def test_empty_string_field():
    status, body, _ = call(valid_refund(agent="  "))
    assert status == 400
    assert "agent" in body["error"]


def test_refund_missing_amount():
    req = valid_refund()
    del req["amount"]
    status, body, _ = call(req)
    assert status == 400
    assert "amount" in body["error"]


@pytest.mark.parametrize("amount", ["9000", "nine thousand", True, [9000], {"v": 1}])
def test_non_numeric_amount(amount):
    status, body, _ = call(valid_refund(amount=amount))
    assert status == 400
    assert "must be a number" in body["error"]


def test_negative_amount():
    status, body, _ = call(valid_refund(amount=-1))
    assert status == 400
    assert "negative" in body["error"]


@pytest.mark.parametrize("raw", [None, "", "{not json", "[1, 2]"])
def test_bad_body(raw):
    status, body, _ = call(raw)
    assert status == 400
    assert body["error"]


def test_base64_encoded_body():
    import base64

    event = {
        "requestContext": {"http": {"method": "POST"}},
        "isBase64Encoded": True,
        "body": base64.b64encode(json.dumps(valid_refund()).encode()).decode(),
    }
    response = app.handler(event, None)
    assert response["statusCode"] == 200
