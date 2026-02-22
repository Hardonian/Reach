# Replay Protocol

## Objective

The Replay Protocol allows any Reach user to verify the validity of an execution by re-running it locally and comparing the results.

## Replay Inputs

- **Base Environment**: The runtime version and system metadata.
- **Execution Pack**: The immutable package of code/tools.
- **Input State**: The initial state of the system.
- **Input Events**: The stream of external triggers.

## Comparison Rules

A replay is considered **SUCCEEDED** if:

1. The **Final State Hash** matches.
2. The **Event Log** (ordered) matches.
3. All **Artifact CIDs** (Content IDs) match.

## Replay Commands

```bash
reachctl replay <run-id>
reachctl compare <run-id-1> <run-id-2>
```

## Failure Modes

- **Divergence**: The run produced different results.
- **Timeout**: The run did not complete within the same constraints.
- **Environment Incompatibility**: The local runner cannot replicate the required environment.
