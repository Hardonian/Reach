# UI Gap Map (Scope-Locked for Stitch)

## Target routes (score <= 2)

### `/console/agents`
- Add deterministic loading, empty, and error surfaces around registry datasets.
- Preserve existing registry panels and action affordances.
- Ensure light/dark token parity for table and filter controls.

### `/console/runners`
- Keep orchestration panel structure; add fallback states for queue/run collections.
- Clarify queue saturation and no-run scenarios with concise operator copy.
- Maintain existing routing and command affordances.

### `/console/traces`
- Add explicit states for trace-list loading, no traces, and fetch failure.
- Preserve timeline/detail interaction model and existing nav context.
- Avoid introducing new trace taxonomies or feature scope.

### `/console/evaluation`
- Add loading/empty/error boundaries around evaluation result collections.
- Keep current chart/table hierarchy; avoid adding new top-level panels.
- Use calm, operator-focused language with no marketing tone.

### `/console/datasets`
- Add standardized empty/error UX for dataset inventory and indexing status.
- Preserve existing dataset management primitives and hierarchy.
- Enforce dark/light parity for controls and state containers.

### `/console/integrations`
- Add deterministic empty/error handling for provider lists and connection status.
- Keep current card/list patterns and action layout.
- Do not introduce new providers, routes, or navigation branches.

## Excluded as strong (score = 3)
- `/console`
- `/console/ops`
- `/console/founder`
- `/console/governance/config-as-code`
