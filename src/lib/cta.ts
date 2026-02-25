import type { DashboardPersona, DashboardViewModel } from "@zeo/contracts";

export interface CtaContext {
  includeVerify?: boolean;
  includeOpen?: boolean;
}

function missingEvidenceCount(model: DashboardViewModel): number {
  return model.lists.findings.filter((finding: any) => finding.severity >= 4).length;
}

export function generateCtas(model: DashboardViewModel, persona: DashboardPersona, context: CtaContext = {}): DashboardViewModel["ctas"] {
  const items: DashboardViewModel["ctas"] = [];
  const highRisk = model.summary.riskScore >= 60;
  const missingEvidence = missingEvidenceCount(model);

  if (missingEvidence > 0 || highRisk) {
    items.push({
      id: 'add-missing-evidence',
      label: "Add missing evidence",
      action: `zeo add-note --decision ${model.id} --text "add provenance-backed evidence for top risks"`,
      target: 'evidence',
      priority: 'high',
    });
  }

  items.push({
    id: 'set-review-horizon',
    label: "Set review horizon",
    action: `zeo review weekly --decision ${model.id}`,
    target: 'review',
    priority: 'medium',
  });

  items.push({
    id: 'export-verification-bundle',
    label: "Export verification bundle",
    action: `zeo export bundle --decision ${model.id}`,
    target: 'export',
    priority: 'medium',
  });

  if (context.includeVerify ?? true) {
    items.push({
      id: 'verify-exported-bundle',
      label: "Verify exported bundle",
      action: `zeo verify decision ${model.id}`,
      target: 'verify',
      priority: 'medium',
    });
  }

  if (context.includeOpen ?? true) {
    items.push({
      id: 'open-dashboard',
      label: "Open dashboard",
      action: `zeo view ${model.id} --persona ${persona} --open`,
      target: 'dashboard',
      priority: 'low',
    });
  }

  return items.slice(0, 5);
}
