import json
import re
from pathlib import Path

import cedarpy
import pytest

import app

POLICIES_DIR = Path(__file__).resolve().parents[1] / "policies"
POLICY_FILES = sorted(POLICIES_DIR.glob("*.cedar"))
SCHEMA_TEXT = (POLICIES_DIR / "schema.cedarschema").read_text(encoding="utf-8")


def test_exactly_six_policies():
    assert len(POLICY_FILES) == 6


@pytest.mark.parametrize("path", POLICY_FILES, ids=lambda p: p.name)
def test_policy_file_parses_and_validates(path):
    text = path.read_text(encoding="utf-8")
    assert len(cedarpy.PolicySet.from_str(text)) == 1
    result = cedarpy.validate_policies(text, SCHEMA_TEXT)
    assert result.validation_passed, result.errors
    # File name matches the policy's @id.
    policy = next(iter(json.loads(cedarpy.policies_to_json_str(text))["staticPolicies"].values()))
    assert policy["annotations"]["id"] == path.stem


def test_only_hold_policy_is_approval():
    approval = [pid for pid, ann in app.POLICY_ANNOTATIONS.items() if ann.get("decision") == "APPROVAL"]
    assert approval == ["hold-support-refund-large"]


def test_known_actions_match_schema():
    declared = set(re.findall(r'action "([^"]+)"', str(cedarpy.Schema.from_str(SCHEMA_TEXT))))
    assert declared == set(app.KNOWN_ACTIONS)
