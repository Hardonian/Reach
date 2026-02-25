# Cross-Layer High Priority Summary

Top 10 leverage items:
1. Enforce one governance policy contract in all mutation paths.
2. Centralize identity attribution (`tenant_id`, `actor`, `run_id`) for every action.
3. Promote CPX resolve packets into required human acknowledgement workflow.
4. Add artifact registry API surface with strict tenant scoping.
5. Wire reconciliation loop for stale branches, drift, and lease renewal.
6. Automate Git host check-runs, labels, and SARIF uploads.
7. Expand provider adapter SDK conformance tests.
8. Harden secret redaction for reports/log exports.
9. Add CI verification aliases (`verify:types`, `verify:lint`) and enforce in merge gates.
10. Instrument governance SLOs (determinism, policy latency, escalation turnaround).

Impact:
- **Risk reduction:** 1,2,3,4,5,8
- **Adoption:** 6,7,9
- **Strategic moat:** 3,5,7,10
