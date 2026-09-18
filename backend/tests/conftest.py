import os
import sys

import pytest

# Both Lambda bundles are flat: the shared modules sit next to each app.py.
# src/agent is deliberately absent — it has its own app.py, and test_agent.py
# loads it by path so it cannot shadow the API handler here.
for _src in ("common", "authorize"):
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", _src))


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
