/**
 * Infrastructure Review Example - Seed Script
 *
 * Generates sample Terraform plans for testing policy evaluation.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface TerraformPlan {
  format_version: string;
  terraform_version: string;
  planned_values: {
    root_module: {
      resources: Array<{
        address: string;
        mode: string;
        type: string;
        name: string;
        values: Record<string, unknown>;
      }>;
    };
  };
  cost_estimate?: {
    monthly_usd: number;
    breakdown: Record<string, number>;
  };
}

function generateCompliantPlan(): TerraformPlan {
  return {
    format_version: "1.2",
    terraform_version: "1.6.0",
    planned_values: {
      root_module: {
        resources: [
          {
            address: "aws_instance.web[0]",
            mode: "managed",
            type: "aws_instance",
            name: "web",
            values: {
              instance_type: "t3.micro",
              tags: {
                Environment: "production",
                Owner: "platform-team",
                CostCenter: "engineering",
              },
              monitoring: true,
            },
          },
          {
            address: "aws_s3_bucket.data",
            mode: "managed",
            type: "aws_s3_bucket",
            name: "data",
            values: {
              bucket: "myapp-data-prod",
              tags: {
                Environment: "production",
                Owner: "data-team",
                CostCenter: "engineering",
              },
            },
          },
          {
            address: "aws_db_instance.main",
            mode: "managed",
            type: "aws_db_instance",
            name: "main",
            values: {
              instance_class: "db.t3.micro",
              engine: "postgres",
              encrypted: true,
              tags: {
                Environment: "production",
                Owner: "db-team",
                CostCenter: "engineering",
              },
            },
          },
        ],
      },
    },
    cost_estimate: {
      monthly_usd: 247.35,
      breakdown: {
        compute: 120.5,
        storage: 89.25,
        networking: 37.6,
      },
    },
  };
}

function generateExpensivePlan(): TerraformPlan {
  const plan = generateCompliantPlan();
  plan.planned_values.root_module.resources[0].values.instance_type = "c5.4xlarge";
  plan.planned_values.root_module.resources[2].values.instance_class = "db.r5.2xlarge";
  plan.cost_estimate = {
    monthly_usd: 1847.92,
    breakdown: {
      compute: 1420.8,
      storage: 340.5,
      networking: 86.62,
    },
  };
  return plan;
}

function generateInsecurePlan(): TerraformPlan {
  const plan = generateCompliantPlan();
  // Add public S3 bucket (security violation)
  plan.planned_values.root_module.resources.push({
    address: "aws_s3_bucket_public_access_block.data",
    mode: "managed",
    type: "aws_s3_bucket_public_access_block",
    name: "data",
    values: {
      bucket: "${aws_s3_bucket.data.id}",
      block_public_acls: false,
      block_public_policy: false,
      tags: {
        Environment: "production",
        Owner: "data-team",
        CostCenter: "engineering",
      },
    },
  });
  plan.cost_estimate!.monthly_usd = 247.35;
  return plan;
}

export function seed(): { success: boolean; message: string } {
  console.log("🌱 Seeding infra-review example...");

  const plansDir = resolve(__dirname, ".plans");
  if (!existsSync(plansDir)) {
    mkdirSync(plansDir, { recursive: true });
  }

  // Generate various plan scenarios
  const plans = {
    "compliant.plan.json": generateCompliantPlan(),
    "expensive.plan.json": generateExpensivePlan(),
    "insecure.plan.json": generateInsecurePlan(),
  };

  for (const [filename, plan] of Object.entries(plans)) {
    writeFileSync(resolve(plansDir, filename), JSON.stringify(plan, null, 2));
    console.log(`   Generated: ${filename}`);
  }

  console.log("\n✅ Plan files generated successfully:");
  console.log("   - compliant.plan.json (should PASS all policies)");
  console.log("   - expensive.plan.json (should FAIL cost policy)");
  console.log("   - insecure.plan.json (should FAIL security policy)");

  return { success: true, message: "Plan files generated" };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = seed();
  process.exit(result.success ? 0 : 1);
}
