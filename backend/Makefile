# PromptFence backend.
#   make setup   create .venv with runtime + test deps
#   make test    run pytest (no AWS needed)
#   make local   sam build, then serve the API on http://localhost:3001 (needs SAM CLI + Docker)
#                runs stateless: local-env.json blanks the table names
#   make seed    put the three demo agents into the deployed agents table, print API keys
#                (table from $$AGENTS_TABLE, else from `sam list stack-outputs`)

PYTHON ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3)
STACK_NAME ?= promptfence

.PHONY: setup test build local seed

setup:
	python3 -m venv .venv
	.venv/bin/pip install -r src/authorize/requirements.txt -r requirements-dev.txt

test:
	RUNNING_TESTS=1 $(PYTHON) -m pytest tests

build:
	sam build

local: build
	sam local start-api --port 3001 --env-vars local-env.json

seed:
	@table="$${AGENTS_TABLE:-$$(sam list stack-outputs --stack-name $(STACK_NAME) --output json | \
		$(PYTHON) -c 'import json, sys; print(next(o["OutputValue"] for o in json.load(sys.stdin) if o["OutputKey"] == "AgentsTableName"))')}"; \
	if [ -z "$$table" ]; then echo "Set AGENTS_TABLE, or deploy stack '$(STACK_NAME)' first." >&2; exit 1; fi; \
	AGENTS_TABLE="$$table" $(PYTHON) scripts/seed_agents.py

# Called by `sam build` (template.yaml: Metadata.BuildMethod makefile).
# Packages the handler, the Cedar policies, and Lambda-compatible wheels
# (Python 3.11, manylinux x86_64) regardless of the host's Python version.
build-AuthorizeFunction:
	$(PYTHON) -m pip install -r src/authorize/requirements.txt \
		--target "$(ARTIFACTS_DIR)" \
		--platform manylinux2014_x86_64 --implementation cp --python-version 3.11 \
		--only-binary=:all: --upgrade --quiet
	cp src/authorize/*.py "$(ARTIFACTS_DIR)/"
	mkdir -p "$(ARTIFACTS_DIR)/policies"
	cp policies/*.cedar policies/schema.cedarschema "$(ARTIFACTS_DIR)/policies/"
