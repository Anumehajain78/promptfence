import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "authorize"))


@pytest.fixture(autouse=True)
def no_aws(monkeypatch):
    """Force the fallback (no-DynamoDB) path so tests never need AWS."""
    for var in ("AGENTS_TABLE", "SESSIONS_TABLE", "DECISIONS_TABLE", "EVENT_BUS_NAME",
                "SESSION_TOTAL_OVERRIDE", "POLICIES_DIR"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("RUNNING_TESTS", "1")
    # boto3 clients are cached per cold start; never reuse one across tests.
    import ledger

    monkeypatch.setattr(ledger, "_clients", {})
