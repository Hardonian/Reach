# Reach Capability Registry ## Overview

The Capability Registry serves as the source of truth for all atomic units of functionality available to the Reach execution environment. It defines what agents can do, what permissions they need, and ensuring that all execution is explicit and validated.

## Data Structure ### Capability

A `Capability` is a granular, versioned unit of logic.

```go
type Capability struct {
    ID                  string                 `json:"id"`                   // Unique identifier (e.g., "fs.read", "llm.generate")
    Version             string                 `json:"version"`              // Semver (e.g., "1.0.0")
    Description         string                 `json:"description"`          // Human-readable description
    RequiredTools       []string               `json:"required_tools"`       // List of atomic tool names this capability utilizes
    RequiredPermissions []string               `json:"required_permissions"` // List of permission scopes needed
    RequiredModels      []string               `json:"required_models"`      // Specific model identifiers if restricted
    Deterministic       bool                   `json:"deterministic"`        // True if output depends solely on input
    Stateful            bool                   `json:"stateful"`             // True if execution alters persistent state
    InputSchema         map[string]interface{} `json:"input_schema"`         // JSON Schema for input arguments
    OutputSchema        map[string]interface{} `json:"output_schema"`        // JSON Schema for output data
}
```

## Validation Rules ### 1. Registry Integrity

- All capabilities must have a unique `ID` + `Version` pair.
- Circular dependencies are not supported (Capabilities are atomic).

### 2. Pack Compatibility - **Tool Existence**: Every tool listed in `RequiredTools` must be available in the underlying runtime environment.
- **Permission Check**: The runtime must grant the `RequiredPermissions` for the capability to be loadable.

### 3. Execution Constraints - **Deterministic Flag**: If `Deterministic` is true, the runtime may cache results based on input hash.
- **Stateful Flag**: If `Stateful` is true, simple retries are unsafe without rollback mechanisms.

## Operating Model The Registry acts as a gatekeeper.

1. **Registration**: Services/Plugins register capabilities at startup.
2. **Resolution**: The Planner requests capabilities by ID.
3. **Enforcement**: The Executor verifies that the active `ExecutionPack` includes the necessary capabilities before invoking tools.

## Standard Capabilities | ID | Description | Tools | Permissions |
| :--- | :--- | :--- | :--- |
| `io.fs.read` | Read access to file system | `read_file`, `list_dir` | `fs:read` |
| `io.fs.write` | Write access to file system | `write_file`, `delete_file` | `fs:write` |
| `net.http.get` | Outbound HTTP GET requests | `http_get` | `net:outbound` |
| `sys.cmd.exec` | Execute shell commands | `run_command` | `sys:exec` |
