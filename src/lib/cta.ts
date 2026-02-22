import type { DashboardPersona, DashboardViewModel } from "@zeo/contracts";

export interface CtaContext {
  includeVerify?: boolean;
  includeOpen?: boolean;
}

function missingEvidenceCount(model: DashboardViewModel): number {
  return model.lists.findings.filter((finding) => finding.severity >= 4).length;
}

export function generateCtas(model: DashboardViewModel, persona: DashboardPersona, context: CtaContext = {}): DashboardViewModel["ctas"] {
  const items: DashboardViewModel["ctas"] = [];
  const highRisk = model.summary.riskScore >= 60;
  const missingEvidence = missingEvidenceCount(model);

  if (missingEvidence > 0 || highRisk) {
    items.push({
      label: "Add missing evidence",
      command: `zeo add-note --decision ${model.id} --text "add provenance-backed evidence for top risks"`,
      reason: "Reduces uncertainty for high-severity findings.",
      priority: 1,
    });
  }

  items.push({
    label: "Set review horizon",
    command: `zeo review weekly --decision ${model.id}`,
    reason: "Monitors sensitivity and assumption drift over time.",
    priority: 2,
  });

  items.push({
    label: "Export verification bundle",
    command: `zeo export bundle --decision ${model.id}`,
    reason: "Captures reproducible artifacts for audit and sharing.",
    priority: 3,
  });

  if (context.includeVerify ?? true) {
    items.push({
      label: "Verify exported bundle",
      command: `zeo verify decision ${model.id}`,
      reason: "Confirms replay integrity before external sharing.",
      priority: 4,
    });
  }

  if (context.includeOpen ?? true) {
    items.push({
      label: "Open dashboard",
      command: `zeo view ${model.id} --persona ${persona} --open`,
      reason: "Review the decision map and top policy triggers.",
      priority: 5,
    });
  }

  return items
    .slice(0, 5)
    .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
}
