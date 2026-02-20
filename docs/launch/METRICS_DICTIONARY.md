# Metrics Dictionary

## Business Metrics

| Metric | Definition | Source |
|--------|------------|--------|
| **CAC** | Customer Acquisition Cost | Marketing Spend / New Customers |
| **MRR** | Monthly Recurring Revenue | Stripe |
| **Churn** | % of customers cancelling per month | Stripe |
| **NRR** | Net Revenue Retention | Stripe |

## Product Metrics

| Metric | Definition | Source |
|--------|------------|--------|
| **Activation Rate** | % of signups who run 1+ workflow | `reach metrics gtm` |
| **WAA** | Weekly Active Agents (Unique Agent IDs run) | `reach metrics gtm` |
| **Pack Install Rate** | % of users installing >1 pack | `reach metrics gtm` |

## Operational Metrics

| Metric | Definition | Source |
|--------|------------|--------|
| **Cost Per Run** | Avg infrastructure cost per execution | `reach cost report` |
| **Token Efficiency** | Tokens used per successful outcome | `reach cost report` |
| **Error Rate** | % of runs ending in failure | `reach doctor` / Logs |
| **P95 Latency** | 95th percentile execution time | `reach perf` |

## Data Location
- **Raw Logs:** `/telemetry/ledger/*.jsonl`
- **Aggregates:** `/telemetry/rollups/*.json`
- **Config:** `/config/economics.json`
