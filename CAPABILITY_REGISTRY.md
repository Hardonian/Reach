# Capability Registry

The Capability Registry serves as the central authority for defining, validating, and retrieving available capabilities within the Reach execution environment. A "Capability" is a unit of functionality (e.g., a tool, a semantic skill, or a data access pattern) that can be linked to an execution plan.

## Data Structure

```go
type Capability struct {
    ID                  string            `json:"id"`                  // Unique identifier (e.g., "std.fs.write")
    Version             string            `json:"version"`             // Semver (e.g., "1.0.0")
    Description         string            `json:"description"`         // Human-readable description
    RequiredTools       []string          `json:"required_tools"`      // List of atomic tools (e.g., "tool.write_file")
    RequiredPermissions []string          `json:"required_permissions"`// Scopes (e.g., "filesystem:write")
    RequiredModels      []string          `json:"required_models"`     // Model constraints (e.g., "gemini-pro")
    Deterministic       bool              `json:"deterministic"`       // If true, same input always = same output
    Stateful            bool              `json:"stateful"`            // If true, capability affects session state
    InputSchema         map[string]any    `json:"input_schema"`        // JSON Schema for input
    OutputSchema        map[string]any    `json:"output_schema"`       // JSON Schema for output
}
```

## Validation Rules

1.  **Atomic Integrity**: A capability cannot be registered if its `RequiredTools` are not registered in the underlying tool system.
2.  **Permission Consistency**: A capability cannot require permissions that valid connectors or policies explicitly deny.
3.  **Schema Enforcement**: All tool calls mediated by this capability must validate against `InputSchema`.
4.  **Version Awareness**: Capabilities are immutable by version. A change in behavior requires a new version.

## Registry Interface

The registry implementation provides:

- `GetCapability(id, version string) (*Capability, error)`
- `ValidatePackCompatibility(pack Manifest) error`: Ensures a pack's requested capabilities exist and are compatible.
- `PreventImplicitAccess(toolName string, declaredCapabilities []string) error`: Verifies that a low-level tool call is authorized by a declared capability.

## Integration

The Registry is consumed by:
1.  **Planner**: To know what tools/actions are available.
2.  **Coordinator**: To validate the `ExecutionPack` before starting a session.
3.  **Executor (Sandboxed)**: To check runtime permissions on every tool invocation.
