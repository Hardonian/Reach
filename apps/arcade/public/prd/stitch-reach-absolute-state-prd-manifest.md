# Stitch Absolute State PRD Manifest

Imported from `stitch_reach_the_absolute_state_prd.zip` on 2026-02-25.

## Classification

This ZIP contains UI prototypes (`code.html` + `screen.png`) rather than markdown PRD chapters.

## Consolidated Mapping

| Prototype family | Reach destination | Action | Why |
|---|---|---|---|
| `ops_center*`, `integrated_ops_monitoring*` | `/console/ops` | SKIP_STRONG | Existing authority route exists.
| `governance_gate*`, `governance_config_gates` | `/console/governance` and `/console/governance/config-as-code` | SKIP_STRONG | Existing governance routes/components are canonical.
| `replay_timeline*`, `decision_replay_viewer`, `replay_explorer` | `/console/traces` and `/docs/absolute-state-prd` | SKIP_STRONG + COPY_DOC | Existing trace route plus docs references.
| `extension_*`, `extension_registry` | `/console/ecosystem` and `/console/integrations` | SKIP_STRONG | Existing ecosystem/integration pages cover this scope.
| `tenant_inspector`, `enterprise_portal` | `/enterprise` and `/docs/absolute-state-prd` | SKIP_STRONG + COPY_DOC | Enterprise entrypoint exists; no OSS-to-enterprise cross-import.
| `cli_*`, `debugger_*`, `lineage_*`, `integrity_*`, `data_merge_resolution*` | `/docs/absolute-state-prd` | COPY_DOC | Best fit is PRD documentation references, not net-new app routes.
| `oss_landing_*`, `support_help_center`, `roadmap_whitepaper_index` | `/` and `/support` docs references | SKIP_STRONG + COPY_DOC | Marketing/support authority pages already exist.

## Source Artifact Paths

- `/tmp/stitch_import/absolute_state_prd/stitch_reach_the_absolute_state_prd/*/code.html`
- `/tmp/stitch_import/absolute_state_prd/stitch_reach_the_absolute_state_prd/*/screen.png`

## Notes

- No new dashboard routes added.
- All integrations are consolidation-first and docs-linked.
- OSS/Enterprise boundaries remain unchanged.
