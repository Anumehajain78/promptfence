"""Session ledger: DynamoDB reads/writes and EventBridge publishing.

Tables (see template.yaml):
  agents     PK agent_id
  sessions   PK session_id            seq, running_refund_total, allowed, held, denied
  decisions  PK session_id, SK seq    one item per decision

Every decision is recorded in one DynamoDB transaction that (a) bumps the
session's seq and counters and (b) writes the decision item. The session update
is conditional on seq still being the value we read before Cedar evaluated, so
two concurrent requests cannot both spend the same headroom under the ceiling:
the loser gets LedgerConflict and the caller re-reads and re-evaluates.
"""

import json
import logging
import os
from decimal import Decimal

from boto3.dynamodb.types import TypeDeserializer, TypeSerializer

logger = logging.getLogger("promptfence.ledger")
logger.setLevel(logging.INFO)

_clients = {}
_serializer = TypeSerializer()
_deserializer = TypeDeserializer()

COUNTER_FOR_DECISION = {"ALLOW": "allowed", "APPROVAL": "held", "DENY": "denied"}


class LedgerConflict(Exception):
    """The session changed between read and write. Re-read and re-evaluate."""


def client(service):
    if service not in _clients:
        import boto3
        from botocore.config import Config

        _clients[service] = boto3.client(
            service,
            config=Config(connect_timeout=2, read_timeout=5, retries={"max_attempts": 2, "mode": "standard"}),
        )
    return _clients[service]


def agents_table():
    return os.environ.get("AGENTS_TABLE") or None


def sessions_table():
    return os.environ.get("SESSIONS_TABLE") or None


def decisions_table():
    return os.environ.get("DECISIONS_TABLE") or None


def event_bus():
    return os.environ.get("EVENT_BUS_NAME") or None


def enabled():
    """True when the session ledger is configured. Otherwise the handler runs stateless."""
    return bool(sessions_table() and decisions_table())


def _plain(value):
    """DynamoDB numbers come back as Decimal; the API speaks ints."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def _serialize(item):
    return {k: _serializer.serialize(v) for k, v in item.items()}


def _deserialize(item):
    return _plain({k: _deserializer.deserialize(v) for k, v in item.items()})


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

def get_agent(agent_id):
    resp = client("dynamodb").get_item(TableName=agents_table(), Key={"agent_id": {"S": agent_id}})
    return _deserialize(resp["Item"]) if "Item" in resp else None


def get_session(session_id):
    resp = client("dynamodb").get_item(
        TableName=sessions_table(), Key={"session_id": {"S": session_id}}, ConsistentRead=True
    )
    return _deserialize(resp["Item"]) if "Item" in resp else None


def list_decisions(session_id):
    """All decisions for a session, seq ascending."""
    items, kwargs = [], {
        "TableName": decisions_table(),
        "KeyConditionExpression": "session_id = :sid",
        "ExpressionAttributeValues": {":sid": {"S": session_id}},
        "ScanIndexForward": True,
        "ConsistentRead": True,
    }
    while True:
        resp = client("dynamodb").query(**kwargs)
        items.extend(_deserialize(i) for i in resp.get("Items", []))
        if "LastEvaluatedKey" not in resp:
            return items
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------

def record_decision(record, expected_seq, refund_added):
    """Atomically bump the session and write the decision item.

    record        decision item; record["seq"] must be expected_seq + 1
    expected_seq  the session's seq when it was read (0 = session did not exist)
    refund_added  amount to ADD to running_refund_total (0 unless ALLOW refund)
    """
    counter = COUNTER_FOR_DECISION[record["decision"]]
    names = {
        "#seq": "seq",
        "#agent": "agent_id",
        "#total": "running_refund_total",
        "#allowed": "allowed",
        "#held": "held",
        "#denied": "denied",
        "#created": "created_at",
        "#updated": "updated_at",
    }
    values = {
        ":next": record["seq"],
        ":agent": record["agent"],
        ":ts": record["ts"],
        ":added": refund_added,
        ":allowed": 1 if counter == "allowed" else 0,
        ":held": 1 if counter == "held" else 0,
        ":denied": 1 if counter == "denied" else 0,
    }
    if expected_seq == 0:
        # First touch: creates the session with zeroed counters (ADD starts from 0).
        condition = "attribute_not_exists(session_id)"
    else:
        condition = "#seq = :prev"
        values[":prev"] = expected_seq

    try:
        client("dynamodb").transact_write_items(
            TransactItems=[
                {
                    "Update": {
                        "TableName": sessions_table(),
                        "Key": {"session_id": {"S": record["session_id"]}},
                        "UpdateExpression": (
                            "SET #seq = :next, #agent = if_not_exists(#agent, :agent), "
                            "#created = if_not_exists(#created, :ts), #updated = :ts "
                            "ADD #total :added, #allowed :allowed, #held :held, #denied :denied"
                        ),
                        "ConditionExpression": condition,
                        "ExpressionAttributeNames": names,
                        "ExpressionAttributeValues": _serialize(values),
                    }
                },
                {
                    "Put": {
                        "TableName": decisions_table(),
                        "Item": _serialize(record),
                        "ConditionExpression": "attribute_not_exists(session_id)",
                    }
                },
            ]
        )
    except client("dynamodb").exceptions.TransactionCanceledException as err:
        reasons = [r.get("Code") for r in err.response.get("CancellationReasons", [])]
        if "ConditionalCheckFailed" in reasons:
            raise LedgerConflict(record["session_id"]) from err
        raise


def delete_session(session_id):
    """Deletes all decisions, then the session item. Idempotent."""
    ddb = client("dynamodb")
    keys = [{"session_id": {"S": session_id}, "seq": {"N": str(d["seq"])}} for d in list_decisions(session_id)]
    for start in range(0, len(keys), 25):
        requests = [{"DeleteRequest": {"Key": k}} for k in keys[start:start + 25]]
        while requests:
            resp = ddb.batch_write_item(RequestItems={decisions_table(): requests})
            requests = resp.get("UnprocessedItems", {}).get(decisions_table(), [])
    ddb.delete_item(TableName=sessions_table(), Key={"session_id": {"S": session_id}})


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

def publish_decision(record):
    """Best effort. A failure here is logged and never changes the HTTP response."""
    bus = event_bus()
    if not bus:
        return
    try:
        resp = client("events").put_events(
            Entries=[{
                "EventBusName": bus,
                "Source": "promptfence",
                "DetailType": record["decision"],
                "Detail": json.dumps(record, ensure_ascii=False),
            }]
        )
        if resp.get("FailedEntryCount"):
            logger.error("eventbridge put_events rejected entry: %s", resp.get("Entries"))
    except Exception:
        logger.exception("eventbridge put_events failed session=%s seq=%s",
                         record.get("session_id"), record.get("seq"))
