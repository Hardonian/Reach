# Hello World Example

The simplest possible Reach pack—your first step into deterministic execution.

## What This Demonstrates

- Basic pack structure and manifest format
- Sequential step execution
- Deterministic output guarantees
- Zero-configuration runs

## Running It

```bash
# Basic run
reach demo hello-world

# With verbose output
reach demo hello-world --verbose

# Export the run capsule
reach demo hello-world --export ./my-first-run.reach
```

## Expected Output

```
[reach] Loading pack: examples.hello-world@v1.0.0
[reach] Executing 3 steps...

  👋 Welcome to Reach!

  This pack runs with deterministic guarantees.

  Every run produces identical output given the same inputs.

[reach] ✓ Execution complete
[reach] Fingerprint: sha256:a3f7b2...
```

## The Pack Manifest

```json
{
  "spec_version": "1.0",
  "metadata": {
    "id": "examples.hello-world",
    "version": "1.0.0"
  },
  "execution_graph": {
    "steps": [
      { "id": "greet", "tool": "echo", "input": "Welcome to Reach! 👋" },
      { "id": "explain", "tool": "echo", "input": "...", "depends_on": ["greet"] }
    ]
  },
  "deterministic": true
}
```

Key points:
- `spec_version` ensures compatibility
- `deterministic: true` enables replay verification
- Steps declare dependencies for ordered execution
- Each step has a unique `id` for referencing outputs

## Replay Verification

The same pack run twice produces identical fingerprints:

```bash
$ reach demo hello-world --json | jq '.fingerprint'
"sha256:a3f7b2d8e9c1..."

$ reach demo hello-world --json | jq '.fingerprint'
"sha256:a3f7b2d8e9c1..."  # Identical!
```

## Next Steps

Try the [drift-detection](../drift-detection/) example to see how Reach detects execution anomalies.
