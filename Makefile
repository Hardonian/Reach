.PHONY: doctor demo fixtures clean help release-artifacts go-module-sanity

# Default target
help:
	@echo "Reach Development Commands:"
	@echo "  make doctor          - Run reach doctor checks"
	@echo "  make demo            - Run quickstart demo"
	@echo "  make fixtures        - Validate all fixtures"
	@echo "  make clean           - Clean build artifacts"
	@echo "  make release-artifacts - Build release artifacts"
	@echo "  make go-module-sanity - Test Go modules"

# Run reach doctor
doctor:
	./reach doctor

# Run quickstart demo
demo:
	node examples/01-quickstart-local/run.js

# Validate fixtures
fixtures:
	@for file in fixtures/events/*.json; do \
		echo "Validating $$file..."; \
		node -e "JSON.parse(require('fs').readFileSync('$$file'))" || exit 1; \
	done
	@echo "All fixtures valid!"

# Clean build artifacts
clean:
	rm -rf node_modules
	rm -rf dist
	rm -rf .next
	go clean -cache

# Build release artifacts
release-artifacts:
	./tools/release/build.sh

# Test Go modules
go-module-sanity:
	./tools/ci/go-test-modules.sh
