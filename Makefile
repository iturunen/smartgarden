venv:
	@test -d .venv || python3 -m venv .venv
	. .venv/bin/activate; pip install $(EXTRA_PIP_ARGS) --no-cache-dir --upgrade pip pip-tools
	. .venv/bin/activate; pip install $(EXTRA_PIP_ARGS) --no-cache-dir pip-tools
	. .venv/bin/activate; pip-sync $(EXTRA_PIP_ARGS) requirements.txt

.PHONY: compile-requirements
compile-requirements:
	. .venv/bin/activate; pip-compile $(EXTRA_PIP_ARGS) --rebuild --no-emit-index-url requirements.in

.PHONY: format
format:
	. .venv/bin/activate; black . && isort . && flake8 .

.PHONY: lint
lint:
	. .venv/bin/activate; black --check . && isort -c . && flake8 .
