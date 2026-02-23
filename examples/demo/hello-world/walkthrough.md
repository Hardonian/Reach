# Hello World - CLI Walkthrough

## Step 1: Verify Installation

```bash
reach doctor
```

Expected output:

```
[✓] reachctl binary
[✓] Node.js >= 18
[✓] Required directories
```

## Step 2: Run the Example

```bash
reach demo hello-world
```

You'll see:

- Pack loading confirmation
- Step-by-step execution
- Final fingerprint

## Step 3: Verify Determinism

Run twice and compare:

```bash
reach demo hello-world --json > run1.json
reach demo hello-world --json > run2.json
diff run1.json run2.json  # Should be identical
```

## Step 4: Export the Capsule

```bash
reach demo hello-world --export hello.reach
ls -la hello.reach
```

## Step 5: Replay from Capsule

```bash
reach replay hello.reach
```

The replay produces the same output as the original run.

## CLI Flags Reference

| Flag              | Description                  |
| ----------------- | ---------------------------- |
| `--verbose`       | Show detailed execution info |
| `--json`          | Output machine-readable JSON |
| `--export <path>` | Save run capsule             |
| `--dry-run`       | Validate without executing   |

## Troubleshooting

**"Pack not found"**

- Ensure you're in the repository root
- Verify the examples are present: `ls examples/demo/`

**"Determinism check failed"**

- Some systems may have timezone differences
- Check that your system clock is accurate
