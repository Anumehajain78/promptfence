# PromptFence backend.
#   make setup   create .venv with runtime + test deps
#   make test    run pytest (no AWS needed)
#   make local   sam build, then serve the API on http://localhost:3001 (needs SAM CLI + Docker)

PYTHON ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3)

.PHONY: setup test build local

setup:
	python3 -m venv .venv
	.venv/bin/pip install -r src/authorize/requirements.txt -r requirements-dev.txt

test:
	RUNNING_TESTS=1 $(PYTHON) -m pytest tests

build:
	sam build

local: build
	sam local start-api --port 3001

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
