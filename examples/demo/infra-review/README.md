# Infrastructure Review Example

Demonstrates Reach as a policy engine for infrastructure change approval.

## What This Demonstrates

- Multi-policy evaluation (cost + security + tagging)
- Conditional approval with recommendations
- Integration with Terraform/IaC workflows
- Evidence gathering for audit trails

## The Scenario

Your team wants to deploy infrastructure changes. Before applying:

1. **Cost Policy** - Monthly spend must stay under budget
2. **Security Policy** - No high-severity misconfigurations
3. **Tagging Policy** - All resources must have required tags

Reach evaluates all policies and provides a recommendation.

## Running It

```bash
# Review with default plan
reach demo infra-review

# Review custom Terraform plan
reach demo infra-review --plan ./terraform.plan.json

# Simulate budget violation
reach demo infra-review --plan ./expensive.plan.json
```

## Expected Output (Approval)

```
[reach] Loading pack: examples.infra-review@v1.0.0
[reach] Evaluating 3 policies...

  📋 Policy Evaluation:

  ┌─ cost-ceiling-1k ─────────────────────┐
  │ Status: ✓ PASS                        │
  │ Estimated: $247/month                 │
  │ Ceiling: $1,000/month                 │
  │ Margin: 75.3%                         │
  └───────────────────────────────────────┘

  ┌─ security-no-high-severity ───────────┐
  │ Status: ✓ PASS                        │
  │ High: 0  Medium: 1  Low: 3            │
  │ Scan duration: 1.2s                   │
  └───────────────────────────────────────┘

  ┌─ require-tags ────────────────────────┐
  │ Status: ✓ PASS                        │
  │ Required: Environment, Owner, CostCenter│
  │ Compliance: 12/12 resources           │
  └───────────────────────────────────────┘

[reach] ✅ RECOMMENDATION: APPROVE
[reach] All policies passed. Ready for deployment.
```

## Expected Output (Denial)

```
[reach] ❌ RECOMMENDATION: DENY

Policy Violations:
  ✗ cost-ceiling-1k
    Estimated: $1,847/month
    Ceiling: $1,000/month
    Exceeds by: $847 (84.7%)

  ✗ security-no-high-severity
    High severity finding: S3 bucket public-read
    Resource: aws_s3_bucket.data_store

Required Actions:
  1. Reduce instance sizes or count
  2. Fix S3 bucket ACL
  3. Re-run review
```

## Policy Configuration

Policies are defined in `policy-packs/`:

```json
// policy-packs/infrastructure/cost-ceiling.json
{
  "id": "cost-ceiling-1k",
  "type": "cost",
  "rules": [
    {
      "metric": "monthly_estimate_usd",
      "operator": "less_than",
      "value": 1000
    }
  ],
  "severity": "blocking"
}
```

## Terraform Integration

Add to your CI/CD pipeline:

```bash
#!/bin/bash
# infra-review.sh

# Generate plan
terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# Reach review
RESULT=$(reach demo infra-review --plan ./plan.json --json)
RECOMMENDATION=$(echo $RESULT | jq -r '.recommendation')

if [ "$RECOMMENDATION" != "APPROVE" ]; then
  echo "Infrastructure review failed"
  echo $RESULT | jq '.violations'
  exit 1
fi

# Safe to apply
terraform apply tfplan
```

## Evidence Trail

Every review generates an evidence capsule:

```json
{
  "reviewId": "review_abc123",
  "timestamp": "2024-01-15T10:30:00Z",
  "planHash": "sha256:def456...",
  "policies": [...],
  "results": [...],
  "recommendation": "APPROVE",
  "fingerprint": "sha256:abc789..."
}
```

Store these for compliance audits.

## Extending with Custom Policies

Create organization-specific policies:

```typescript
// policies/require-encryption.ts
export const requireEncryptionPolicy: Policy = {
  id: 'require-encryption',
  evaluate(plan: InfraPlan): PolicyResult {
    const unencrypted = plan.resources.filter(
      r => r.type === 'aws_ebs_volume' && !r.encrypted
    );
    return {
      pass: unencrypted.length === 0,
      violations: unencrypted.map(r => ({
        resource: r.id,
        message: 'EBS volume must be encrypted'
      }))
    };
  }
};
```

## Next Steps

Explore [cost-guard](../cost-guard/) for budget-aware execution routing.
