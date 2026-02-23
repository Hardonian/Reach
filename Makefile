# Reach Deterministic Execution Fabric
# Makefile for build, install, and release operations

.PHONY: help build install release clean test verify version

# Version information
VERSION := $(shell cat VERSION 2>/dev/null || echo "0.3.1")
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE := $(shell date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "unknown")

# Build directories
BUILD_DIR := build
DIST_DIR := dist

# Binary names
BINARY_NAME := reachctl
REACH_WRAPPER := reach

# Go build flags
# -trimpath: Remove file system paths from binary for reproducibility and smaller size
# -ldflags -s -w: Strip symbol table and debug info for smaller binaries
LDFLAGS := -trimpath -ldflags "-X main.version=$(VERSION) -X main.commit=$(GIT_COMMIT) -X main.buildDate=$(BUILD_DATE)"
RELEASE_LDFLAGS := -trimpath -ldflags "-s -w -X main.version=$(VERSION) -X main.commit=$(GIT_COMMIT) -X main.buildDate=$(BUILD_DATE)"

# Default target
help:
	@echo "Reach Deterministic Execution Fabric - Build System"
	@echo ""
	@echo "DEVELOPMENT"
	@echo "  make build          - Build reachctl binary (development)"
	@echo "  make install        - Install binaries to system (requires admin/root)"
	@echo "  make test           - Run all tests"
	@echo "  make verify         - Run full verification suite"
	@echo "  make doctor         - Run reach doctor checks"
	@echo ""
	@echo "RELEASE"
	@echo "  make release        - Build stripped release binaries"
	@echo "  make release-all    - Build for all target platforms"
	@echo "  make clean          - Remove build artifacts"
	@echo ""
	@echo "EXAMPLES"
	@echo "  make demo           - Run quickstart demo"
	@echo "  make fixtures       - Validate all fixtures"
	@echo ""
	@echo "VERSION: $(VERSION) (commit: $(GIT_COMMIT))"

# Build development binary
build:
	@echo "Building $(BINARY_NAME) v$(VERSION)..."
	@mkdir -p $(BUILD_DIR)
	cd services/runner && go build $(LDFLAGS) -o ../../$(BUILD_DIR)/$(BINARY_NAME) ./cmd/reachctl
	@cp $(REACH_WRAPPER) $(BUILD_DIR)/
	@echo "Built: $(BUILD_DIR)/$(BINARY_NAME)"
	@echo "Built: $(BUILD_DIR)/$(REACH_WRAPPER)"

# Install to system
install: build
	@echo "Installing Reach v$(VERSION)..."
	@if [ "$(OS)" = "Windows_NT" ]; then \
		echo "Please manually copy $(BUILD_DIR)/$(BINARY_NAME) to your PATH"; \
	else \
		install -d $(DESTDIR)/usr/local/bin; \
		install -m 755 $(BUILD_DIR)/$(BINARY_NAME) $(DESTDIR)/usr/local/bin/; \
		install -m 755 $(BUILD_DIR)/$(REACH_WRAPPER) $(DESTDIR)/usr/local/bin/; \
		echo "Installed to /usr/local/bin/"; \
	fi
	@echo "Installation complete!"

# Build release binary (stripped symbols)
release:
	@echo "Building release binary (stripped)..."
	@mkdir -p $(DIST_DIR)
	cd services/runner && go build $(RELEASE_LDFLAGS) -o ../../$(DIST_DIR)/$(BINARY_NAME) ./cmd/reachctl
	@cp $(REACH_WRAPPER) $(DIST_DIR)/
	@echo "Release binary: $(DIST_DIR)/$(BINARY_NAME)"
	@echo "Size: $$(ls -lh $(DIST_DIR)/$(BINARY_NAME) | awk '{print $$5}')"

# Build for all platforms
release-all: clean
	@echo "Building for all platforms..."
	@mkdir -p $(DIST_DIR)
	
	# Linux AMD64
	@echo "  -> linux/amd64..."
	@cd services/runner && GOOS=linux GOARCH=amd64 go build $(RELEASE_LDFLAGS) -o ../../$(DIST_DIR)/$(BINARY_NAME)-linux-amd64 ./cmd/reachctl
	
	# Linux ARM64
	@echo "  -> linux/arm64..."
	@cd services/runner && GOOS=linux GOARCH=arm64 go build $(RELEASE_LDFLAGS) -o ../../$(DIST_DIR)/$(BINARY_NAME)-linux-arm64 ./cmd/reachctl
	
	# macOS AMD64
	@echo "  -> darwin/amd64..."
	@cd services/runner && GOOS=darwin GOARCH=amd64 go build $(RELEASE_LDFLAGS) -o ../../$(DIST_DIR)/$(BINARY_NAME)-darwin-amd64 ./cmd/reachctl
	
	# macOS ARM64
	@echo "  -> darwin/arm64..."
	@cd services/runner && GOOS=darwin GOARCH=arm64 go build $(RELEASE_LDFLAGS) -o ../../$(DIST_DIR)/$(BINARY_NAME)-darwin-arm64 ./cmd/reachctl
	
	# Windows AMD64
	@echo "  -> windows/amd64..."
	@cd services/runner && GOOS=windows GOARCH=amd64 go build $(RELEASE_LDFLAGS) -o ../../$(DIST_DIR)/$(BINARY_NAME)-windows-amd64.exe ./cmd/reachctl
	
	@echo ""
	@echo "Release artifacts:"
	@ls -lh $(DIST_DIR)/

# Run tests
test:
	@echo "Running tests..."
	cd services/runner && go test ./... -v

# Run verification
verify:
	@echo "Running full verification..."
	./$(REACH_WRAPPER) doctor
	$(MAKE) test
	$(MAKE) fixtures
	@echo "All verification passed!"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BUILD_DIR) $(DIST_DIR)
	@go clean -cache
	@echo "Clean complete"

# Run doctor
doctor:
	./$(REACH_WRAPPER) doctor

# Run demo
demo:
	node examples/01-quickstart-local/run.js

# Validate fixtures
fixtures:
	@for file in fixtures/events/*.json; do \
		echo "Validating $$file..."; \
		node -e "JSON.parse(require('fs').readFileSync('$$file'))" || exit 1; \
	done
	@echo "All fixtures valid!"

# Show version
version:
	@echo "Reach v$(VERSION)"
	@echo "Commit: $(GIT_COMMIT)"
	@echo "Build Date: $(BUILD_DATE)"

# Legacy targets for compatibility
release-artifacts: release-all
go-module-sanity: test
