# Reach CLI Benchmarking

Reach provides a native benchmarking harness via `reach benchmark` to measure the performance, resource utilization, and evaluation fidelity of execution packs.

## Core Metrics

Every benchmark run captures the following indicators:

- **Duration**: Total walls-clock time for the run, including engine initialization.
- **Memory Utilization**: Peak heap allocation during evaluation.
- **Artifact Footprint**: Total size of generated artifacts and event logs.
- **Policy Evaluation Latency**: The overhead introduced by the policy governance engine.

## Usage

Run a standard benchmark with 3 trials:

```bash
reach benchmark --pack arcadeSafe.demo --trials 3
```

For JSON output:

```bash
reach benchmark --pack arcadeSafe.demo --json
```

## Storage

Results are stored locally in:
`~/.reach/benchmarks/`

These results can be used for trend analysis and regression detection in CI pipelines.

## CI Integration

To prevent performance regressions, benchmarks should be run on every release candidate. A degradation of >10% in average duration will trigger a warning in the `verify:full` gate.
