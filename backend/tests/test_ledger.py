"""Ledger, sessions and attack-run tests against moto (no AWS account)."""

import json
import os
import sys

import boto3
import pytest
from moto import mock_aws

import app
import ledger

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import seed_agents  # noqa: E402

REGION = "ap-south-1"


@pytest.fixture
def aws(monkeypatch):
    """moto DynamoDB + EventBridge shaped like template.yaml."""
    for var, value in {
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "AWS_SESSION_TOKEN": "testing",
        "AWS_DEFAULT_REGION": REGION,
        "AGENTS_TABLE": "pf-agents",
        "SESSIONS_TABLE": "pf-sessions",
        "DECISIONS_TABLE": "pf-decisions",
        "EVENT_BUS_NAME": "promptfence-bus",
    }.items():
        monkeypatch.setenv(var, value)

    with mock_aws():
        ddb = boto3.client("dynamodb", region_name=REGION)
        for name, keys in {
            "pf-agents": [("agent_id", "S", "HASH")],
            "pf-sessions": [("session_id", "S", "HASH")],
            "pf-decisions": [("session_id", "S", "HASH"), ("seq", "N", "RANGE")],
        }.items():
            ddb.create_table(
                TableName=name,
                BillingMode="PAY_PER_REQUEST",
                AttributeDefinitions=[{"AttributeName": n, "AttributeType": t} for n, t, _ in keys],
                KeySchema=[{"AttributeName": n, "KeyType": k} for n, _, k in keys],
            )

        boto3.client("events", region_name=REGION).create_event_bus(Name="promptfence-bus")

        yield {"ddb": ddb}


def invoke(route_key, body=None, path_id=None):
    event = {"routeKey": route_key, "requestContext": {"http": {"method": route_key.split()[0]}}}
    if body is not None:
        event["body"] = json.dumps(body)
    if path_id is not None:
        event["pathParameters"] = {"id": path_id}
    response = app.handler(event, None)
    return response["statusCode"], (json.loads(response["body"]) if response["body"] else None)


def authorize(session="s1", agent="support-agent", action="refund", amount=9000, resource="order-1"):
    body = {"agent": agent, "session": session, "action": action, "resource": resource}
    if amount is not None:
        body["amount"] = amount
    return invoke("POST /v1/authorize", body)


def session_item(aws, session_id):
    item = aws["ddb"].get_item(TableName="pf-sessions", Key={"session_id": {"S": session_id}}).get("Item")
    return ledger._deserialize(item) if item else None


# --- /v1/authorize persistence ----------------------------------------------

def test_authorize_persists_decision(aws):
    status, body = authorize(amount=5000)
    assert status == 200
    assert body["decision"] == "ALLOW"
    assert body["seq"] == 1
    assert body["ts"].endswith("Z")
    assert body["session_total"] == 0

    decisions = ledger.list_decisions("s1")
    assert len(decisions) == 1
    d = decisions[0]
    assert {k: d[k] for k in ("session_id", "seq", "agent", "action", "resource", "amount", "decision",
                              "policy", "session_total_before", "session_total_after")} == {
        "session_id": "s1", "seq": 1, "agent": "support-agent", "action": "refund", "resource": "order-1",
        "amount": 5000, "decision": "ALLOW", "policy": "allow-support-refund-small",
        "session_total_before": 0, "session_total_after": 5000,
    }
    assert d["reason"] and d["ts"] == body["ts"]

    session = session_item(aws, "s1")
    assert session["agent_id"] == "support-agent"
    assert (session["seq"], session["running_refund_total"]) == (1, 5000)
    assert (session["allowed"], session["held"], session["denied"]) == (1, 0, 0)


def test_total_increases_only_on_allow_refund(aws):
    _, first = authorize(amount=9000)                          # ALLOW
    assert first["decision"] == "ALLOW"
    assert session_item(aws, "s1")["running_refund_total"] == 9000

    _, held = authorize(amount=42000)                          # APPROVAL
    assert held["decision"] == "APPROVAL"
    assert held["session_total"] == 9000
    assert session_item(aws, "s1")["running_refund_total"] == 9000

    _, denied = authorize(action="delete_customer", amount=None)  # DENY
    assert denied["decision"] == "DENY"
    assert session_item(aws, "s1")["running_refund_total"] == 9000

    _, second = authorize(amount=1000)                         # ALLOW, sees the accumulated total
    assert second["session_total"] == 9000
    session = session_item(aws, "s1")
    assert session["running_refund_total"] == 10000
    assert (session["seq"], session["allowed"], session["held"], session["denied"]) == (4, 2, 1, 1)


def test_ledger_total_feeds_cedar_ceiling(aws):
    # Real accumulation, no override: 39 x 9000 then the 40th is denied.
    for i in range(39):
        _, body = authorize(amount=9000, resource=f"order-{i}")
        assert body["decision"] == "ALLOW", i
    _, body = authorize(amount=9000)
    assert body["decision"] == "DENY"
    assert body["policy"] == "cumulative-refund-ceiling-v1"
    assert body["session_total"] == 351000


def test_session_total_override_ignored_when_ledger_enabled(aws, monkeypatch):
    monkeypatch.setenv("SESSION_TOTAL_OVERRIDE", "351000")
    _, body = authorize(amount=9000)
    assert body["decision"] == "ALLOW"
    assert body["session_total"] == 0


def test_role_comes_from_agents_table(aws):
    aws["ddb"].put_item(TableName="pf-agents", Item={"agent_id": {"S": "vip-agent"}, "role": {"S": "finance"}})
    status, body = authorize(agent="vip-agent", amount=80000)
    assert status == 200
    assert body["policy"] == "allow-finance-refund"


def test_concurrent_write_is_detected_and_reevaluated(aws, monkeypatch):
    # Simulate another request landing between our read and our write.
    real_get_session = ledger.get_session
    raced = {"done": False}

    def racing_get_session(session_id):
        item = real_get_session(session_id)
        if not raced["done"]:
            raced["done"] = True
            monkeypatch.setattr(ledger, "get_session", real_get_session)
            ledger.record_decision(
                {"session_id": session_id, "seq": 1, "agent": "support-agent", "action": "refund",
                 "resource": "other", "amount": 9000, "decision": "ALLOW", "policy": "allow-support-refund-small",
                 "reason": "x", "session_total_before": 0, "session_total_after": 9000, "ts": "t"},
                expected_seq=0, refund_added=9000,
            )
        return item

    monkeypatch.setattr(ledger, "get_session", racing_get_session)
    status, body = authorize(amount=9000)
    assert status == 200
    assert body["seq"] == 2
    assert body["session_total"] == 9000          # re-read after the conflict
    assert session_item(aws, "s1")["running_refund_total"] == 18000


def test_missing_table_returns_503(aws, monkeypatch):
    monkeypatch.setenv("SESSIONS_TABLE", "does-not-exist")
    status, body = authorize(amount=9000)
    assert status == 503
    assert "ledger is unavailable" in body["error"]


# --- EventBridge -------------------------------------------------------------

def test_authorize_publishes_decision_event(aws, monkeypatch):
    # Spy on the real (moto) client: moto still validates the bus and entry.
    # Asserting delivery to a rule target would need moto[events] (jsonpath-ng).
    events = ledger.client("events")
    real_put_events = events.put_events
    sent = []

    def spy(**kwargs):
        response = real_put_events(**kwargs)
        sent.append((kwargs, response))
        return response

    monkeypatch.setattr(events, "put_events", spy)
    _, body = authorize(amount=42000)

    assert len(sent) == 1
    (request, response), = sent
    assert response["FailedEntryCount"] == 0
    (entry,) = request["Entries"]
    assert entry["EventBusName"] == "promptfence-bus"
    assert entry["Source"] == "promptfence"
    assert entry["DetailType"] == "APPROVAL"
    detail = json.loads(entry["Detail"])
    assert detail["seq"] == body["seq"] == 1
    assert detail["policy"] == "hold-support-refund-large"
    assert detail["session_total_before"] == detail["session_total_after"] == 0


def test_eventbridge_failure_does_not_change_response(aws, monkeypatch):
    _, baseline = authorize(session="ok", amount=5000)

    class BrokenEvents:
        def put_events(self, **kwargs):
            raise RuntimeError("eventbridge is down")

    real_client = ledger.client
    monkeypatch.setattr(ledger, "client", lambda service: BrokenEvents() if service == "events" else real_client(service))
    status, body = authorize(session="broken", amount=5000)

    assert status == 200
    assert {k: v for k, v in body.items() if k != "ts"} == {k: v for k, v in baseline.items() if k != "ts"}
    assert len(ledger.list_decisions("broken")) == 1


# --- /v1/attack-run ----------------------------------------------------------

def test_attack_run_defaults_blocks_on_40th(aws):
    status, body = invoke("POST /v1/attack-run", {})
    assert status == 200
    assert body["session_id"].startswith("attack-") and len(body["session_id"]) == len("attack-") + 8
    results = body["results"]
    assert len(results) == 40
    assert [r["seq"] for r in results] == list(range(1, 41))
    assert all(r["decision"] == "ALLOW" for r in results[:39])
    assert results[38]["session_total_after"] == 351000
    assert results[39]["decision"] == "DENY"
    assert results[39]["policy"] == "cumulative-refund-ceiling-v1"
    assert results[39]["session_total_after"] == 351000
    assert body["first_denied_seq"] == 40
    assert session_item(aws, body["session_id"])["running_refund_total"] == 351000


def test_attack_run_without_body_uses_defaults(aws):
    status, body = invoke("POST /v1/attack-run")
    assert status == 200
    assert body["first_denied_seq"] == 40


def test_attack_run_stops_at_first_deny(aws):
    # 35 x 10000 = 350000 allowed; the 36th would reach 360000.
    status, body = invoke("POST /v1/attack-run", {"session": "stop", "count": 60, "amount": 10000})
    assert status == 200
    assert body["first_denied_seq"] == 36
    assert len(body["results"]) == 36


def test_attack_run_without_deny_runs_full_count(aws):
    # Refunds above 10000 are APPROVAL for support; they never add to the total, so no DENY.
    status, body = invoke("POST /v1/attack-run", {"session": "held", "count": 5, "amount": 42000})
    assert status == 200
    assert body["first_denied_seq"] is None
    assert [r["decision"] for r in body["results"]] == ["APPROVAL"] * 5
    assert session_item(aws, "held")["running_refund_total"] == 0


@pytest.mark.parametrize("payload, message", [
    ({"count": 101}, "must not exceed 100"),
    ({"count": 0}, "at least 1"),
    ({"count": "40"}, "whole number"),
    ({"amount": "abc"}, "must be a number"),
    ({"agent": "mystery-agent"}, "Unknown agent"),
])
def test_attack_run_rejects_bad_input(aws, payload, message):
    status, body = invoke("POST /v1/attack-run", payload)
    assert status == 400
    assert message in body["error"]


# --- /v1/sessions/{id} -------------------------------------------------------

def test_get_session_returns_ordered_timeline_and_counters(aws):
    authorize(session="t1", amount=9000, resource="a")                     # ALLOW
    authorize(session="t1", amount=42000, resource="b")                    # APPROVAL
    authorize(session="t1", action="delete_customer", amount=None, resource="c")  # DENY
    authorize(session="t1", amount=1000, resource="d")                     # ALLOW

    status, body = invoke("GET /v1/sessions/{id}", path_id="t1")
    assert status == 200
    assert body["session_id"] == "t1"
    assert body["agent"] == "support-agent"
    assert body["running_refund_total"] == 10000
    assert body["ceiling"] == 355000
    assert (body["allowed"], body["held"], body["denied"]) == (2, 1, 1)
    assert [d["seq"] for d in body["decisions"]] == [1, 2, 3, 4]
    assert [d["resource"] for d in body["decisions"]] == ["a", "b", "c", "d"]
    assert [d["decision"] for d in body["decisions"]] == ["ALLOW", "APPROVAL", "DENY", "ALLOW"]


def test_get_session_orders_numerically_past_nine(aws):
    invoke("POST /v1/attack-run", {"session": "long", "count": 12})
    _, body = invoke("GET /v1/sessions/{id}", path_id="long")
    assert [d["seq"] for d in body["decisions"]] == list(range(1, 13))


def test_get_unknown_session_is_404(aws):
    status, body = invoke("GET /v1/sessions/{id}", path_id="nope")
    assert status == 404
    assert body["error"] == "Session 'nope' not found."


def test_delete_then_get_is_404_and_session_can_rerun(aws):
    invoke("POST /v1/attack-run", {"session": "rerun", "count": 30})
    status, body = invoke("DELETE /v1/sessions/{id}", path_id="rerun")
    assert status == 204
    assert body is None

    status, body = invoke("GET /v1/sessions/{id}", path_id="rerun")
    assert status == 404
    assert ledger.list_decisions("rerun") == []

    status, body = invoke("POST /v1/attack-run", {"session": "rerun"})
    assert body["first_denied_seq"] == 40


def test_delete_unknown_session_is_204(aws):
    status, _ = invoke("DELETE /v1/sessions/{id}", path_id="never-existed")
    assert status == 204


# --- scripts/seed_agents.py --------------------------------------------------

def test_seed_agents(aws):
    keys = seed_agents.seed("pf-agents", boto3.resource("dynamodb", region_name=REGION))
    assert set(keys) == {"support-agent", "finance-agent", "intern-agent"}
    for agent_id, key in keys.items():
        prefix = f"pf_live_{agent_id}_"
        assert key.startswith(prefix)
        suffix = key[len(prefix):]
        assert len(suffix) == 12 and int(suffix, 16) >= 0
        item = ledger.get_agent(agent_id)
        assert item["api_key"] == key and item["display_name"]
    assert ledger.get_agent("intern-agent")["role"] == "intern"
