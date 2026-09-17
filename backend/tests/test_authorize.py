import base64
import json

import pytest

import app


def call(body):
    event = {
        "routeKey": "POST /v1/authorize",
        "requestContext": {"http": {"method": "POST"}},
        "body": body if isinstance(body, str) or body is None else json.dumps(body),
    }
    response = app.handler(event, None)
    return response["statusCode"], json.loads(response["body"]), response["headers"]


def request(agent="support-agent", action="refund", amount=9000, **overrides):
    body = {"agent": agent, "session": "sess-001", "action": action, "resource": "order-123"}
    if amount is not None:
        body["amount"] = amount
    body.update(overrides)
    return body


# --- Cedar decisions (fallback path: no DynamoDB) ---------------------------

def test_support_refund_small_allows():
    status, body, headers = call(request(amount=5000))
    assert status == 200
    assert body["decision"] == "ALLOW"
    assert body["policy"] == "allow-support-refund-small"
    assert body["session_total"] == 0
    assert body["ceiling"] == 355000
    assert body["reason"]
    # Stateless fallback: nothing recorded, so no seq; ts is always set.
    assert body["seq"] is None
    assert body["ts"].endswith("Z")
    assert headers["Access-Control-Allow-Origin"] == "*"


def test_support_refund_large_needs_approval():
    status, body, _ = call(request(amount=42000))
    assert status == 200
    assert body["decision"] == "APPROVAL"
    assert body["policy"] == "hold-support-refund-large"


def test_session_ceiling_denies_small_refund(monkeypatch):
    # 40th refund of 9000: 351000 + 9000 = 360000 > 355000.
    monkeypatch.setenv("SESSION_TOTAL_OVERRIDE", "351000")
    status, body, _ = call(request(amount=9000))
    assert status == 200
    assert body["decision"] == "DENY"
    assert body["policy"] == "cumulative-refund-ceiling-v1"
    assert body["session_total"] == 351000


def test_session_ceiling_allows_39th_refund(monkeypatch):
    # 39th refund of 9000: 342000 + 9000 = 351000 <= 355000.
    monkeypatch.setenv("SESSION_TOTAL_OVERRIDE", "342000")
    status, body, _ = call(request(amount=9000))
    assert status == 200
    assert body["decision"] == "ALLOW"
    assert body["policy"] == "allow-support-refund-small"


def test_session_ceiling_boundary_is_inclusive(monkeypatch):
    # 346000 + 9000 = 355000 is not above the ceiling.
    monkeypatch.setenv("SESSION_TOTAL_OVERRIDE", "346000")
    status, body, _ = call(request(amount=9000))
    assert status == 200
    assert body["decision"] == "ALLOW"


def test_ceiling_forbid_beats_approval_permit(monkeypatch):
    # 320000 + 42000 = 362000 > 355000: the forbid beats the APPROVAL permit.
    monkeypatch.setenv("SESSION_TOTAL_OVERRIDE", "320000")
    status, body, _ = call(request(amount=42000))
    assert body["decision"] == "DENY"
    assert body["policy"] == "cumulative-refund-ceiling-v1"


def test_session_total_override_ignored_outside_tests(monkeypatch):
    monkeypatch.setenv("SESSION_TOTAL_OVERRIDE", "45000")
    monkeypatch.delenv("RUNNING_TESTS")
    status, body, _ = call(request(amount=9000))
    assert body["decision"] == "ALLOW"
    assert body["session_total"] == 0


def test_support_delete_customer_denied():
    status, body, _ = call(request(action="delete_customer", amount=None))
    assert status == 200
    assert body["decision"] == "DENY"
    assert body["policy"] == "forbid-support-delete"
    assert body["ceiling"] is None


def test_finance_refund_allowed():
    status, body, _ = call(request(agent="finance-agent", amount=80000))
    assert status == 200
    assert body["decision"] == "ALLOW"
    assert body["policy"] == "allow-finance-refund"


def test_finance_refund_over_limit_has_no_matching_policy():
    status, body, _ = call(request(agent="finance-agent", amount=150000))
    assert body["decision"] == "DENY"
    assert body["policy"] == "no-matching-policy"


def test_intern_export_denied():
    status, body, _ = call(request(agent="intern-agent", action="export_customer_data", amount=None))
    assert status == 200
    assert body["decision"] == "DENY"
    assert body["policy"] == "forbid-intern-export"


def test_unknown_agent_is_400():
    status, body, _ = call(request(agent="mystery-agent"))
    assert status == 400
    assert "Unknown agent 'mystery-agent'" in body["error"]


def test_unknown_action_is_400():
    status, body, _ = call(request(action="transfer_funds"))
    assert status == 400
    assert "Unknown action" in body["error"]


# --- Validation (unchanged behaviour) ---------------------------------------

@pytest.mark.parametrize("field", ["agent", "session", "action", "resource"])
def test_missing_required_field(field):
    req = request()
    del req[field]
    status, body, headers = call(req)
    assert status == 400
    assert field in body["error"]
    assert headers["Access-Control-Allow-Origin"] == "*"


def test_empty_string_field():
    status, body, _ = call(request(agent="  "))
    assert status == 400
    assert "agent" in body["error"]


def test_refund_missing_amount():
    status, body, _ = call(request(amount=None))
    assert status == 400
    assert "amount" in body["error"]


@pytest.mark.parametrize("amount", ["abc", "9000", True, [9000], {"v": 1}])
def test_non_numeric_amount(amount):
    status, body, _ = call(request(amount=amount))
    assert status == 400
    assert "must be a number" in body["error"]


def test_negative_amount():
    status, body, _ = call(request(amount=-1))
    assert status == 400
    assert "negative" in body["error"]


def test_fractional_amount():
    status, body, _ = call(request(amount=9000.5))
    assert status == 400
    assert "whole number" in body["error"]


def test_huge_amount():
    status, body, _ = call(request(amount=10**15))
    assert status == 400
    assert "must not exceed" in body["error"]


@pytest.mark.parametrize("raw", [None, "", "{not json", "[1, 2]"])
def test_bad_body(raw):
    status, body, _ = call(raw)
    assert status == 400
    assert body["error"]


def test_base64_encoded_body():
    event = {
        "routeKey": "POST /v1/authorize",
        "requestContext": {"http": {"method": "POST"}},
        "isBase64Encoded": True,
        "body": base64.b64encode(json.dumps(request(amount=5000)).encode()).decode(),
    }
    response = app.handler(event, None)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["decision"] == "ALLOW"


def test_unknown_route_is_404():
    response = app.handler({"routeKey": "GET /v1/nope", "requestContext": {"http": {"method": "GET"}}}, None)
    assert response["statusCode"] == 404
    assert "No route" in json.loads(response["body"])["error"]


def test_sessions_routes_need_ledger_configured():
    event = {"routeKey": "GET /v1/sessions/{id}", "pathParameters": {"id": "s1"},
             "requestContext": {"http": {"method": "GET"}}}
    response = app.handler(event, None)
    assert response["statusCode"] == 503
    assert "not configured" in json.loads(response["body"])["error"]
