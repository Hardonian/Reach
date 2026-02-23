# Infrastructure Review - CLI Walkthrough

## Step 1: Generate Sample Plans

```bash
cd examples/demo/infra-review
npx tsx seed.ts
```

Creates three plan scenarios in `.plans/`.

## Step 2: Review Compliant Plan

```bash
reach demo infra-review --plan .plans/compliant.plan.json
```

Expected: ✅ All policies pass

## Step 3: Review Expensive Plan

```bash
reach demo infra-review --plan .plans/expensive.plan.json
```

Expected: ❌ Cost policy violation

```
Estimated: $1,847.92/month
Ceiling: $1,000.00/month
Exceeds by: 84.7%
```

## Step 4: Review Insecure Plan

```bash
reach demo infra-review --plan .plans/insecure.plan.json
```

Expected: ❌ Security policy violation

```
High severity: S3 bucket allows public access
Resource: aws_s3_bucket_public_access_block.data
```

## Step 5: Export Review Report

```bash
reach demo infra-review --plan .plans/compliant.plan.json \
  --export-report review-result.json

cat review-result.json | jq '.recommendation, .confidence'
```

## Policy Flags

| Flag                | Description                           |
| ------------------- | ------------------------------------- |
| `--plan <path>`     | Path to Terraform plan JSON           |
| `--policies <list>` | Comma-separated policy IDs            |
| `--strict`          | Fail on ANY violation (including low) |
| `--export-report`   | Save detailed results                 |
| `--explain`         | Show policy decision reasoning        |

## CI Integration

```yaml
# .github/workflows/infra-review.yml
- name: Review Infrastructure
  run: |
    terraform plan -out=tfplan
    terraform show -json tfplan > plan.json
    reach demo infra-review --plan plan.json --strict || exit 1
```
