import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getGateRun, getGate } from "@/lib/cloud-db";
import { getWorkflowRun } from "@/lib/db/workflows";

export const runtime = "nodejs";

export interface FailureExplanation {
  summary: string;
  root_cause: {
    type: "gate_failure" | "workflow_error" | "policy_violation" | "threshold_breach" | "unknown";
    description: string;
    failing_component: string;
  };
  details: {
    failing_rule?: string;
    expected_value?: string;
    actual_value?: string;
    error_message?: string;
    stack_trace?: string;
  };
  context: {
    run_id: string;
    gate_id?: string;
    workflow_id?: string;
    timestamp: string;
    duration_ms?: number;
  };
  recommendations: {
    immediate_action: string;
    fix_steps: string[];
    prevention_tips: string[];
    documentation_links: { label: string; url: string }[];
  };
  related_runs: {
    id: string;
    status: string;
    timestamp: string;
    similarity_score: number;
  }[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id: reportId } = await params;

  // Try to find the run - could be a gate run or workflow run
  let run = await getGateRun(reportId, ctx.tenantId);
  let runType: "gate" | "workflow" = "gate";

  if (!run) {
    const workflowRun = await getWorkflowRun(reportId, ctx.tenantId);
    if (workflowRun) {
      run = workflowRun as unknown as typeof run;
      runType = "workflow";
    }
  }

  if (!run) {
    return cloudErrorResponse("Report not found", 404);
  }

  // Generate explanation based on run type and failure mode
  const explanation = await generateExplanation(run, runType, ctx.tenantId);

  return NextResponse.json({ explanation });
}

async function generateExplanation(
  run: any,
  runType: "gate" | "workflow",
  tenantId: string,
): Promise<FailureExplanation> {
  const isFailure = run.status === "failed" || run.status === "error" || run.status === "blocked";

  if (!isFailure) {
    return {
      summary: "This run completed successfully with no failures to explain.",
      root_cause: {
        type: "unknown",
        description: "No failure detected",
        failing_component: "N/A",
      },
      details: {},
      context: {
        run_id: run.id,
        timestamp: run.created_at,
      },
      recommendations: {
        immediate_action: "No action required - run was successful",
        fix_steps: [],
        prevention_tips: [],
        documentation_links: [],
      },
      related_runs: [],
    };
  }

  // Extract failure details from the run report
  const report = run.report_json ? JSON.parse(run.report_json) : {};
  const findings = report.findings || [];
  const failingFindings = findings.filter((f: any) => f.status === "failed" || f.status === "violation");

  // Determine root cause type and generate explanation
  let rootCauseType: FailureExplanation["root_cause"]["type"] = "unknown";
  let description = "An error occurred during execution";
  let failingComponent = "Unknown component";
  let immediateAction = "Review the error details and retry";
  let fixSteps: string[] = [];
  let preventionTips: string[] = [];

  if (runType === "gate") {
    const gate = await getGate(run.gate_id, tenantId);
    failingComponent = gate?.name || run.gate_id;

    if (report.violations > 0) {
      rootCauseType = "policy_violation";
      description = `Gate failed with ${report.violations} policy violation(s)`;
      immediateAction = "Review violated policies and fix the underlying issues";
      fixSteps = [
        "Click on each failing check to see the detailed violation",
        "Navigate to the source file mentioned in the violation",
        "Apply the suggested fix or suppress with justification",
        "Re-run the gate to verify the fix",
      ];
      preventionTips = [
        "Add pre-commit hooks to catch violations early",
        "Use the policy simulator to test changes before enforcing",
        "Enable auto-fix suggestions in your IDE",
      ];
    } else if (report.pass_rate < 1.0) {
      rootCauseType = "threshold_breach";
      description = `Pass rate (${(report.pass_rate * 100).toFixed(1)}%) below required threshold`;
      immediateAction = "Investigate failing checks and improve coverage";
      fixSteps = [
        "Identify which checks are failing in the report",
        "Review the test cases associated with those checks",
        "Add missing test coverage or fix broken tests",
        "Adjust thresholds if they're set incorrectly",
      ];
      preventionTips = [
        "Set up monitoring on pass rate trends",
        "Require PR reviews for threshold changes",
        "Use gradual rollout for new policies",
      ];
    }
  } else {
    // Workflow run failure
    rootCauseType = "workflow_error";
    failingComponent = run.workflow_id || "Workflow";
    description = run.error || "Workflow execution failed";
    immediateAction = "Check the workflow logs for the specific error";
    fixSteps = [
      "Review the error message in the run details",
      "Check if all required inputs were provided",
      "Verify external service availability",
      "Retry the run after fixing the issue",
    ];
    preventionTips = [
      "Add error handling steps to your workflow",
      "Set up alerting for workflow failures",
      "Use circuit breakers for external service calls",
    ];
  }

  return {
    summary: `${failingComponent} failed: ${description}`,
    root_cause: {
      type: rootCauseType,
      description,
      failing_component: failingComponent,
    },
    details: {
      failing_rule: failingFindings[0]?.rule_name,
      expected_value: failingFindings[0]?.expected,
      actual_value: failingFindings[0]?.actual,
      error_message: run.error || report.summary,
    },
    context: {
      run_id: run.id,
      gate_id: run.gate_id,
      workflow_id: run.workflow_id,
      timestamp: run.created_at,
      duration_ms: run.finished_at
        ? new Date(run.finished_at).getTime() - new Date(run.created_at).getTime()
        : undefined,
    },
    recommendations: {
      immediate_action: immediateAction,
      fix_steps: fixSteps,
      prevention_tips: preventionTips,
      documentation_links: [
        { label: "Troubleshooting Guide", url: "/docs/troubleshooting" },
        { label: "Policy Configuration", url: "/docs/policies" },
        { label: "Gate Best Practices", url: "/docs/gates" },
      ],
    },
    related_runs: [], // Would be populated from similarity search in production
  };
}
