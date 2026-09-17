"""Seed the agents table with the three demo agents and print their API keys.

Usage:
  AGENTS_TABLE=<table> python scripts/seed_agents.py
  python scripts/seed_agents.py --table <table>

Re-running overwrites the agents and rotates their keys.
"""

import argparse
import os
import secrets
import sys

import boto3

AGENTS = [
    {"agent_id": "support-agent", "role": "support", "display_name": "Support Agent"},
    {"agent_id": "finance-agent", "role": "finance", "display_name": "Finance Agent"},
    {"agent_id": "intern-agent", "role": "intern", "display_name": "Intern Agent"},
]


def make_api_key(agent_id):
    return f"pf_live_{agent_id}_{secrets.token_hex(6)}"


def seed(table_name, dynamodb=None):
    """Writes the demo agents. Returns {agent_id: api_key}."""
    table = (dynamodb or boto3.resource("dynamodb")).Table(table_name)
    keys = {}
    for agent in AGENTS:
        api_key = make_api_key(agent["agent_id"])
        table.put_item(Item={**agent, "api_key": api_key})
        keys[agent["agent_id"]] = api_key
    return keys


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--table", default=os.environ.get("AGENTS_TABLE"), help="agents table name")
    args = parser.parse_args(argv)
    if not args.table:
        parser.error("agents table name required: pass --table or set AGENTS_TABLE")

    keys = seed(args.table)
    print(f"Seeded {len(keys)} agents into {args.table}:")
    for agent_id, api_key in keys.items():
        print(f"  {agent_id:<14} {api_key}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
