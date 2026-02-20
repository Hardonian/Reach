# Unit Economics Model

## 1. Cost Buckets

### Fixed Costs
- **Control Plane:** Kubernetes Cluster (EKS/GKE) base cost.
- **Database:** Primary SQL instance (RDS/CloudSQL).
- **DevOps:** CI/CD pipelines, Monitoring (Datadog/Prometheus).

### Semi-Variable Costs
- **Worker Nodes:** Auto-scaling groups for execution runners.
- **Cache:** Redis cluster size (scales with active sessions).

### Variable Costs (Per Run)
- **Compute:** CPU/RAM seconds per execution step.
- **Storage:** Log storage (S3) per run artifact.
- **Egress:** Data transfer out to clients.
- **Tokens:** LLM API costs (if proxied).

## 2. Formulas

```
Cost_Per_Run = (Compute_Sec * Rate_Compute) + (Storage_GB * Rate_Storage) + (Tokens * Rate_Token_Proxy)
```

```
Gross_Margin = (Price_Per_Run - Cost_Per_Run) / Price_Per_Run
```

## 3. Scenario Tiers (Monthly)

| Metric | Seed (0) | Launch (1k) | Growth (10k) | Scale (100k) |
|--------|----------|-------------|--------------|--------------|
| **Active Users** | 50 | 1,000 | 10,000 | 100,000 |
| **Runs/Day** | 200 | 5,000 | 100,000 | 2,000,000 |
| **Storage** | 10 GB | 500 GB | 20 TB | 500 TB |
| **Infra Cost** | $200 | $1,500 | $12,000 | $150,000 |

## 4. Break-Even Math
Assuming **Pro Tier ($29/mo)**:
- **Fixed Cost Baseline:** $5,000/mo
- **Variable Cost/User:** $2.50/mo
- **Break-Even Users:** ~189 users.

## 5. Scale Triggers
- **DB Upgrade:** When `runs_per_second > 50`.
- **Cache Sharding:** When `active_sessions > 5,000`.
- **Worker Split:** When `queue_latency_p95 > 2000ms`.
