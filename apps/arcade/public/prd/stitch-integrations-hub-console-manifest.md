# Stitch Console Integration Manifest

Imported from `stitch_integrations_hub_console.zip` on 2026-02-25.

## Route Mapping (No Duplicate Routes)

| Stitch artifact                | Reach destination route | Destination component                                     | Action                             |
| ------------------------------ | ----------------------- | --------------------------------------------------------- | ---------------------------------- |
| `agent_registry_console`       | `/console/agents`       | `components/stitch/console/pages/AgentRegistry.tsx`       | SKIP_STRONG + MERGE_MISSING_STATES |
| `dataset_management_console`   | `/console/datasets`     | `components/stitch/console/pages/DatasetManagement.tsx`   | SKIP_STRONG + MERGE_MISSING_STATES |
| `evaluation_engine_console`    | `/console/evaluation`   | `components/stitch/console/pages/EvaluationEngine.tsx`    | SKIP_STRONG + MERGE_MISSING_STATES |
| `integrations_hub_console`     | `/console/integrations` | `components/stitch/console/pages/IntegrationsHub.tsx`     | SKIP_STRONG + MERGE_MISSING_STATES |
| `runner_orchestration_console` | `/console/runners`      | `components/stitch/console/pages/RunnerOrchestration.tsx` | SKIP_STRONG + MERGE_MISSING_STATES |
| `trace_explorer_console_*`     | `/console/traces`       | `components/stitch/console/pages/TraceExplorer.tsx`       | SKIP_STRONG + MERGE_MISSING_STATES |

## Source Artifact Paths

- `/tmp/stitch_import/integrations_hub_console/stitch_integrations_hub_console/*/code.html`
- `/tmp/stitch_import/integrations_hub_console/stitch_integrations_hub_console/*/screen.png`

## Notes

- Existing Reach pages are already strong authority surfaces and remain canonical.
- No duplicate dashboard branches were created.
- No deterministic hashing/replay codepaths were modified.
