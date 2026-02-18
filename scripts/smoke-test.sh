#!/bin/bash
# Reach Smoke Test Suite
# 
# This script performs smoke tests on the Reach server.
# It starts a server, runs tests, and cleans up.
#
# Usage:
#   ./scripts/smoke-test.sh

set -euo pipefail

REACH_PORT="${REACH_PORT:-8788}"  # Use non-default port to avoid conflicts
REACH_HOST="${REACH_HOST:-127.0.0.1}"
REACH_BASE_URL="http://${REACH_HOST}:${REACH_PORT}"
DATA_DIR=$(mktemp -d)
SERVER_PID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    rm -rf "$DATA_DIR"
}

trap cleanup EXIT

# Start server
start_server() {
    log_info "Starting Reach server on port $REACH_PORT..."
    
    cd services/runner
    go run ./cmd/reach-serve \
        --port "$REACH_PORT" \
        --bind "$REACH_HOST" \
        --data "$DATA_DIR" &
    SERVER_PID=$!
    cd ../..
    
    # Wait for server to be ready
    log_info "Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -sf "$REACH_BASE_URL/health" >/dev/null 2>&1; then
            log_info "Server is ready!"
            return 0
        fi
        sleep 1
    done
    
    log_error "Server failed to start within 30 seconds"
    return 1
}

# Test health endpoint
test_health() {
    log_info "Testing /health endpoint..."
    
    response=$(curl -sf "$REACH_BASE_URL/health")
    if [ -z "$response" ]; then
        log_error "Health check failed - no response"
        return 1
    fi
    
    if ! echo "$response" | grep -q '"status"'; then
        log_error "Health check failed - invalid response: $response"
        return 1
    fi
    
    log_info "Health check passed: $response"
    return 0
}

# Test version endpoint
test_version() {
    log_info "Testing /version endpoint..."
    
    response=$(curl -sf "$REACH_BASE_URL/version")
    if [ -z "$response" ]; then
        log_error "Version check failed - no response"
        return 1
    fi
    
    if ! echo "$response" | grep -q '"apiVersion"'; then
        log_error "Version check failed - invalid response: $response"
        return 1
    fi
    
    log_info "Version check passed: $response"
    return 0
}

# Test create run
test_create_run() {
    log_info "Testing POST /runs endpoint..."
    
    response=$(curl -sf -X POST "$REACH_BASE_URL/runs" \
        -H "Content-Type: application/json" \
        -d '{"capabilities":["tool.read"],"plan_tier":"free"}')
    
    if [ -z "$response" ]; then
        log_error "Create run failed - no response"
        return 1
    fi
    
    RUN_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    if [ -z "$RUN_ID" ]; then
        log_error "Create run failed - no run ID in response: $response"
        return 1
    fi
    
    log_info "Create run passed: $RUN_ID"
    export RUN_ID
    return 0
}

# Test get run
test_get_run() {
    log_info "Testing GET /runs/{id} endpoint..."
    
    response=$(curl -sf "$REACH_BASE_URL/runs/$RUN_ID")
    if [ -z "$response" ]; then
        log_error "Get run failed - no response"
        return 1
    fi
    
    log_info "Get run passed: $response"
    return 0
}

# Test get run events
test_get_run_events() {
    log_info "Testing GET /runs/{id}/events endpoint..."
    
    response=$(curl -sf "$REACH_BASE_URL/runs/$RUN_ID/events")
    if [ -z "$response" ]; then
        log_error "Get run events failed - no response"
        return 1
    fi
    
    log_info "Get run events passed"
    return 0
}

# Test federation status
test_federation_status() {
    log_info "Testing GET /federation/status endpoint..."
    
    response=$(curl -sf "$REACH_BASE_URL/federation/status")
    if [ -z "$response" ]; then
        log_error "Federation status failed - no response"
        return 1
    fi
    
    log_info "Federation status passed"
    return 0
}

# Test list packs
test_list_packs() {
    log_info "Testing GET /packs endpoint..."
    
    response=$(curl -sf "$REACH_BASE_URL/packs")
    if [ -z "$response" ]; then
        log_error "List packs failed - no response"
        return 1
    fi
    
    log_info "List packs passed"
    return 0
}

# Main test execution
main() {
    log_info "Starting Reach smoke tests..."
    log_info "Data directory: $DATA_DIR"
    log_info "Server URL: $REACH_BASE_URL"
    echo
    
    # Build first
    log_info "Building Reach server..."
    cd services/runner
    go build ./cmd/reach-serve
    cd ../..
    
    # Start server
    start_server
    echo
    
    # Run tests
    FAILED=0
    
    test_health || FAILED=1
    test_version || FAILED=1
    test_create_run || FAILED=1
    test_get_run || FAILED=1
    test_get_run_events || FAILED=1
    test_federation_status || FAILED=1
    test_list_packs || FAILED=1
    
    echo
    if [ $FAILED -eq 0 ]; then
        log_info "All smoke tests passed!"
        exit 0
    else
        log_error "Some smoke tests failed!"
        exit 1
    fi
}

main "$@"
