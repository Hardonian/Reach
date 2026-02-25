#!/bin/bash
# Moves root-level SPEC files into a cohesive docs/specs hierarchy
# Usage: ./scripts/maintenance/restructure-specs.sh

set -e

echo "Restructuring specs..."

# Create directories
mkdir -p docs/specs/protocol
mkdir -p docs/specs/runtime
mkdir -p docs/specs/federation
mkdir -p docs/specs/packaging
mkdir -p docs/specs/ecosystem

# Function to move file if it exists
move_spec() {
  if [ -f "$1" ]; then
    git mv "$1" "$2"
    echo "Moved $1 -> $2"
  else
    echo "Skipped $1 (not found)"
  fi
}

# Protocol
move_spec "EXECUTION_PROTOCOL.md" "docs/specs/protocol/"
move_spec "SPEC_FORMALIZATION_SUMMARY.md" "docs/specs/protocol/"

# Runtime
move_spec "EXECUTION_SPEC.md" "docs/specs/runtime/"
move_spec "GRAPH_EXECUTION_SPEC.md" "docs/specs/runtime/"
move_spec "ADAPTIVE_ENGINE_SPEC.md" "docs/specs/runtime/"
move_spec "MODEL_ROUTING_SPEC.md" "docs/specs/runtime/"

# Federation
move_spec "FEDERATED_EXECUTION_SPEC.md" "docs/specs/federation/"
move_spec "TRUST_NEGOTIATION_SPEC.md" "docs/specs/federation/"

# Packaging
move_spec "EXECUTION_PACK_SPEC.md" "docs/specs/packaging/"
move_spec "AUTOPACK_SPEC.md" "docs/specs/packaging/"
move_spec "CAPABILITY_REGISTRY.md" "docs/specs/packaging/"

# Ecosystem
move_spec "ARCADE_SPEC.md" "docs/specs/ecosystem/"

echo "✅ Restructuring complete."
