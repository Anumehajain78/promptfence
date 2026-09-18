"""Agent tools, tested directly against the same authorize logic the API uses.

No Bedrock: the model is only involved in the integration test at the bottom,
which is skipped unless RUN_BEDROCK_TESTS=1.
"""

import importlib.util
import json
import os

import pytest

AGENT_APP = os.path.join(os.path.dirname(__file__), "..", "src", "agent", "app.py")


def _load_agent_module():
    # Loaded by path under its own name: src/agent/app.py and src/authorize/app.py
    # are both "app.py", and only one can own that name on sys.path.
    spec = importlib.util.spec_from_file_location("promptfence_agent_app", AGENT_APP)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


agent_app = _load_agent_module()


@pytest.fixture
def context():
    return agent_app.ToolContext(session="chat-test")


def refund(context, order_id="ORD-1001", amount=5000):
    return agent_app.refund(context, order_id, amount)


# --- the governed tool ------------------------------------------------------

def test_small_refund_is_executed(context):
    record = refund(context, amount=5000)
    assert record["decision"] == "ALLOW"
    assert record["executed"] is True
    assert "processed" in record["message"]
    assert record["policy"] == "allow-support-refund-small"
    assert context.executed == [{"order_id": "ORD-1001", "amount": 5000}]


def test_large_refund_is_held_for_approval(context):
    record = refund(context, amount=42000)
    assert record["decision"] == "APPROVAL"
    assert record["executed"] is False
    assert "approval" in record["message"].lower()
    assert record["policy"] == "hold-support-refund-large"
    assert context.executed == []


def test_refund_over_session_ceiling_is_blocked(context, monkeypatch):
    monkeypatch.setenv("SESSION_TOTAL_OVERRIDE", "351000")
    record = refund(context, amount=9000)
    assert record["decision"] == "DENY"
    assert record["executed"] is False
    assert "cumulative-refund-ceiling-v1" in record["message"]
    assert context.executed == []


def test_tool_calls_record_every_decision(context, monkeypatch):
    refund(context, amount=5000)
    refund(context, amount=42000)
    monkeypatch.setenv("SESSION_TOTAL_OVERRIDE", "351000")
    refund(context, amount=9000)

    assert [c["decision"] for c in context.calls] == ["ALLOW", "APPROVAL", "DENY"]
    assert [c["executed"] for c in context.calls] == [True, False, False]
    assert [c["tool"] for c in context.calls] == ["refund_order"] * 3
    assert [c["args"]["amount"] for c in context.calls] == [5000, 42000, 9000]
    assert all(c["reason"] for c in context.calls)


def test_bad_arguments_from_the_model_do_not_execute(context):
    record = agent_app.refund(context, "ORD-1001", -5)
    assert record["executed"] is False
    assert record["decision"] == "DENY"
    assert "negative" in record["message"]


# --- tools as the model sees them -------------------------------------------

def test_refund_tool_returns_the_message(context):
    lookup_order, refund_order = agent_app.build_tools(context)
    assert "processed" in refund_order("ord-1001", 5000)   # case and type coerced
    assert context.calls[0]["args"] == {"order_id": "ORD-1001", "amount": 5000}


def test_lookup_order_needs_no_authorization(context):
    lookup_order, _ = agent_app.build_tools(context)
    assert lookup_order("ORD-1003")["amount"] == 5000
    assert "No order" in lookup_order("ORD-9999")["error"]
    assert context.calls == []  # reads never reach PromptFence


def test_context_is_per_request():
    first = agent_app.ToolContext(session="chat-one")
    second = agent_app.ToolContext(session="chat-two")
    refund(first, amount=5000)
    assert len(first.calls) == 1
    assert second.calls == [] and second.executed == []


# --- the reply the customer sees --------------------------------------------

def test_system_prompt_forbids_thinking_in_replies():
    assert "Never include reasoning, thinking tags, or internal notes" in agent_app.SYSTEM_PROMPT


@pytest.mark.parametrize("raw, expected", [
    ("<thinking>weigh the options</thinking>Your refund is done.", "Your refund is done."),
    ("  <thinking>\nline one\nline two\n</thinking>\n\nRefund processed.  ", "Refund processed."),
    ("<THINKING>shouty</THINKING> Done.", "Done."),
    ("<Thinking>first</Thinking>Kept.<thinking>second</thinking>", "Kept."),
    ("Nothing to strip.", "Nothing to strip."),
])
def test_strip_thinking(raw, expected):
    assert agent_app.strip_thinking(raw) == expected


def test_chat_reply_comes_back_without_the_thinking_block(monkeypatch):
    class FakeAgent:
        def __call__(self, message):
            return "<thinking>The customer wants ORD-1001 refunded.\nCheck policy.</thinking>\n\nRefund of ₹5,000 for order ORD-1001 processed."

    monkeypatch.setattr(agent_app, "build_agent", lambda context: FakeAgent())
    reply, context = agent_app.chat("refund ORD-1001", session="chat-strip")

    assert reply == "Refund of ₹5,000 for order ORD-1001 processed."
    assert "<thinking>" not in reply.lower()
    assert context.session == "chat-strip"


# --- handler ----------------------------------------------------------------

def invoke(body):
    event = {"routeKey": "POST /v1/agent/chat", "requestContext": {"http": {"method": "POST"}}}
    if body is not None:
        event["body"] = json.dumps(body)
    response = agent_app.handler(event, None)
    return response["statusCode"], json.loads(response["body"])


@pytest.mark.parametrize("body, message", [
    ({}, "Field 'message' must be a non-empty string."),
    ({"message": "   "}, "Field 'message' must be a non-empty string."),
    ({"message": "hi", "session": ""}, "Field 'session' must be a non-empty string."),
    (None, "Request body is required and must be a JSON object."),
])
def test_handler_rejects_bad_input_before_calling_bedrock(body, message):
    status, payload = invoke(body)
    assert status == 400
    assert payload["error"] == message


def test_handler_returns_reply_and_tool_calls(monkeypatch):
    def fake_chat(message, session=None):
        ctx = agent_app.ToolContext(session=session or "chat-generated")
        agent_app.refund(ctx, "ORD-1001", 5000)
        return "Your refund is on its way.", ctx

    monkeypatch.setattr(agent_app, "chat", fake_chat)
    status, payload = invoke({"message": "refund ORD-1001", "session": "chat-abc"})
    assert status == 200
    assert payload["session"] == "chat-abc"
    assert payload["reply"] == "Your refund is on its way."
    assert payload["tool_calls"] == [{
        "tool": "refund_order",
        "args": {"order_id": "ORD-1001", "amount": 5000},
        "decision": "ALLOW",
        "policy": "allow-support-refund-small",
        "reason": payload["tool_calls"][0]["reason"],
        "executed": True,
    }]


def test_handler_generates_a_session_when_missing(monkeypatch):
    monkeypatch.setattr(agent_app, "chat", lambda message, session=None: ("ok", agent_app.ToolContext(session=session or agent_app.secrets.token_hex(4).join(["chat-", ""]))))
    status, payload = invoke({"message": "hello"})
    assert status == 200
    assert payload["session"].startswith("chat-") and len(payload["session"]) == len("chat-") + 8


def test_handler_reports_a_failed_turn_without_leaking(monkeypatch):
    def boom(message, session=None):
        raise RuntimeError("bedrock exploded")

    monkeypatch.setattr(agent_app, "chat", boom)
    status, payload = invoke({"message": "refund ORD-1001"})
    assert status == 502
    assert payload["error"] == "The agent could not complete this request. Please retry."


# --- live Bedrock (opt in with RUN_BEDROCK_TESTS=1) -------------------------

@pytest.mark.skipif(os.environ.get("RUN_BEDROCK_TESTS") != "1", reason="set RUN_BEDROCK_TESTS=1 to call Bedrock")
def test_live_agent_calls_the_refund_tool():
    reply, context = agent_app.chat("Please refund order ORD-1001, 5000 rupees", session="chat-live")
    assert any(call["tool"] == "refund_order" for call in context.calls)
    assert context.calls[0]["args"]["order_id"] == "ORD-1001"
    assert context.calls[0]["decision"] == "ALLOW"
    assert reply
