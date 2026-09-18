"""PromptFence sample agent Lambda: POST /v1/agent/chat.

A Strands agent on Bedrock reads a customer message and decides which tool to
call. The refund tool is governed: before it does anything it asks PromptFence
by calling authorize() in-process (shared module, not over HTTP), and it never
executes on DENY or APPROVAL.

The attack-run endpoint deliberately does NOT go through this agent — it calls
authorize() directly so the demo is deterministic (see backend/README.md).
"""

import logging
import os
import secrets
from dataclasses import dataclass, field

from strands import Agent, tool
from strands.models import BedrockModel

import authorize as pf  # src/common/authorize.py — packaged next to this file

logger = logging.getLogger("promptfence.agent")
logger.setLevel(logging.INFO)

DEFAULT_MODEL_ID = "apac.amazon.nova-lite-v1:0"
DEFAULT_REGION = "ap-south-1"

# Every tool call is attributed to this agent; roles live in the agents table.
AGENT_ID = "support-agent"

SYSTEM_PROMPT = """You are a customer-support agent for an online store.

You can issue refunds and look up orders. Never invent order IDs: if you do not
have one, ask the customer for it, or use lookup_order to check one they gave you.

When a customer asks for a refund you MUST use the refund_order tool. Never tell
a customer a refund is done unless the tool says it was processed.

Every refund is checked by PromptFence before it runs. The tool will tell you
whether the refund was processed, is waiting for human approval, or was blocked
by policy. Report that outcome honestly and plainly, including when the request
was denied or held. Do not argue with the policy or try the tool again."""

# Five fake orders. Reads need no authorization — looking up an order has no
# real-world consequence, so lookup_order does not call PromptFence.
ORDERS = {
    "ORD-1001": {"order_id": "ORD-1001", "customer": "#CUST-4474", "amount": 9000, "status": "delivered"},
    "ORD-1002": {"order_id": "ORD-1002", "customer": "#CUST-4474", "amount": 42000, "status": "delivered"},
    "ORD-1003": {"order_id": "ORD-1003", "customer": "#CUST-5120", "amount": 5000, "status": "shipped"},
    "ORD-1004": {"order_id": "ORD-1004", "customer": "#CUST-6033", "amount": 1500, "status": "delivered"},
    "ORD-1005": {"order_id": "ORD-1005", "customer": "#CUST-7781", "amount": 120000, "status": "cancelled"},
}


@dataclass
class ToolContext:
    """Request-scoped state. Never a module global: one per invocation, so a
    session id or a tool call can't leak into the next request."""

    session: str
    calls: list = field(default_factory=list)
    executed: list = field(default_factory=list)


def refund(context, order_id, amount):
    """The governed refund. Asks PromptFence first, then acts on the decision.

    Returns the tool-call record, which is also appended to context.calls.
    """
    record = {
        "tool": "refund_order",
        "args": {"order_id": order_id, "amount": amount},
        "decision": None,
        "policy": None,
        "reason": None,
        "executed": False,
        "message": "",
    }
    context.calls.append(record)

    try:
        decision = pf.authorize({
            "agent": AGENT_ID,
            "session": context.session,
            "action": "refund",
            "resource": order_id,
            "amount": amount,
        })
    except pf.ValidationError as err:
        # Bad arguments from the model (unknown action, non-whole amount, …).
        record.update(decision="DENY", policy="invalid-request", reason=str(err))
        record["message"] = f"Refund not authorized: {err}"
        return record

    record.update(
        decision=decision["decision"],
        policy=decision["policy"],
        reason=decision["reason"],
    )
    amount_text = pf._inr(amount)

    if decision["decision"] == "ALLOW":
        # The only branch that touches the "real tool". Recorded per request;
        # ORDERS is not mutated, so one invocation cannot alter another's view.
        context.executed.append({"order_id": order_id, "amount": amount})
        record["executed"] = True
        record["message"] = f"Refund of {amount_text} for order {order_id} processed."
    elif decision["decision"] == "APPROVAL":
        held = decision["seq"] if decision["seq"] is not None else len(context.calls)
        record["message"] = f"Refund of {amount_text} needs human approval — request #{held} held."
    else:
        record["message"] = f"Refund blocked by policy {decision['policy']}: {decision['reason']}"

    logger.info("tool=refund_order session=%s order=%s amount=%s decision=%s executed=%s",
                context.session, order_id, amount, record["decision"], record["executed"])
    return record


def build_tools(context):
    """Tools bound to one request's context by closure."""

    @tool
    def lookup_order(order_id: str) -> dict:
        """Look up one order by its id, e.g. ORD-1001.

        Returns the order's customer, amount in rupees and status, or an error
        when no such order exists. Use this before refunding if you are unsure.
        """
        order = ORDERS.get(order_id.strip().upper())
        if order is None:
            return {"error": f"No order {order_id}. Known orders are {', '.join(sorted(ORDERS))}."}
        return dict(order)

    @tool
    def refund_order(order_id: str, amount: int) -> str:
        """Refund `amount` rupees against `order_id`.

        PromptFence authorizes every refund first. The reply says whether the
        refund was processed, is held for human approval, or was blocked.
        """
        return refund(context, order_id.strip().upper(), int(amount))["message"]

    return [lookup_order, refund_order]


def build_agent(context):
    model = BedrockModel(
        model_id=os.environ.get("BEDROCK_MODEL_ID") or DEFAULT_MODEL_ID,
        region_name=os.environ.get("AWS_REGION") or DEFAULT_REGION,
    )
    return Agent(model=model, tools=build_tools(context), system_prompt=SYSTEM_PROMPT)


def chat(message, session=None):
    """Runs one turn. Returns (reply, context)."""
    context = ToolContext(session=session or f"chat-{secrets.token_hex(4)}")
    agent = build_agent(context)
    result = agent(message)
    return str(result).strip(), context


def handler(event, context):
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    if method == "OPTIONS":
        return pf.json_response(204, None)

    try:
        body = pf.parse_body(event)
        message = body.get("message")
        if not isinstance(message, str) or not message.strip():
            raise pf.ValidationError("Field 'message' must be a non-empty string.")
        session = body.get("session")
        if session is not None and (not isinstance(session, str) or not session.strip()):
            raise pf.ValidationError("Field 'session' must be a non-empty string.")

        reply, tool_context = chat(message, session)
    except pf.ValidationError as err:
        return pf.json_response(400, {"error": str(err)})
    except Exception:
        logger.exception("agent turn failed")
        return pf.json_response(502, {"error": "The agent could not complete this request. Please retry."})

    logger.info("agent session=%s tool_calls=%d", tool_context.session, len(tool_context.calls))
    return pf.json_response(200, {
        "session": tool_context.session,
        "reply": reply,
        "tool_calls": [
            {k: call[k] for k in ("tool", "args", "decision", "policy", "reason", "executed")}
            for call in tool_context.calls
        ],
    })
