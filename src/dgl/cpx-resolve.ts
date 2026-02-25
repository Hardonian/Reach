import fs from 'fs';
import path from 'path';

export interface ConflictPacket {
  packet_id: string;
  left_pack_id: string;
  right_pack_id: string;
  severity: 'low' | 'medium' | 'high';
  reasons: string[];
  text_conflict: number;
  semantic_conflict: number;
  boundary_conflict: number;
}

export interface MergePlanStep {
  step: number;
  action: string;
  target_pack_id?: string;
  guardrail: string;
}

export interface MergePlan {
  run_id: string;
  generated_at: string;
  packets: ConflictPacket[];
  steps: MergePlanStep[];
  dgl_delta_preview_required: true;
  unsafe_auto_merge: false;
}

interface CpxReportLike {
  run_id: string;
  per_patch: Array<{ pack_id: string; score_total: number }>;
  conflict_matrix: Record<string, Record<string, { reasons: string[]; text_conflict: number; semantic_conflict: number; boundary_conflict: number }>>;
}

function severityFrom(conflict: { text_conflict: number; semantic_conflict: number; boundary_conflict: number }): 'low' | 'medium' | 'high' {
  const max = Math.max(conflict.text_conflict, conflict.semantic_conflict, conflict.boundary_conflict);
  if (max >= 0.66) return 'high';
  if (max >= 0.33) return 'medium';
  return 'low';
}

export function buildMergePlan(report: CpxReportLike, nowIso?: string): MergePlan {
  const sortedPatches = [...report.per_patch].sort((a, b) => a.score_total - b.score_total || a.pack_id.localeCompare(b.pack_id));
  const packets: ConflictPacket[] = [];
  const sortedPackIds = Object.keys(report.conflict_matrix).sort();

  for (const left of sortedPackIds) {
    const rights = Object.keys(report.conflict_matrix[left] ?? {}).sort();
    for (const right of rights) {
      if (left >= right) continue;
      const entry = report.conflict_matrix[left]?.[right];
      if (!entry) continue;
      packets.push({
        packet_id: `${report.run_id}:${left.slice(0, 8)}:${right.slice(0, 8)}`,
        left_pack_id: left,
        right_pack_id: right,
        severity: severityFrom(entry),
        reasons: [...entry.reasons].sort(),
        text_conflict: entry.text_conflict,
        semantic_conflict: entry.semantic_conflict,
        boundary_conflict: entry.boundary_conflict,
      });
    }
  }

  packets.sort((a, b) => b.severity.localeCompare(a.severity) || a.packet_id.localeCompare(b.packet_id));

  const steps: MergePlanStep[] = [];
  let index = 1;
  for (const patch of sortedPatches) {
    steps.push({
      step: index++,
      action: 'apply_candidate_patch',
      target_pack_id: patch.pack_id,
      guardrail: 'Apply on isolated branch and run CPX + route checks before moving to next patch.',
    });
  }
  steps.push({
    step: index++,
    action: 'run_dgl_delta_preview',
    guardrail: 'Preview governance delta for all touched trust-boundary files before commit.',
  });
  steps.push({
    step: index,
    action: 'require_human_ack_for_high_conflicts',
    guardrail: 'Any high severity packet requires explicit acknowledgement label before merge.',
  });

  return {
    run_id: report.run_id,
    generated_at: nowIso ?? new Date().toISOString(),
    packets,
    steps,
    dgl_delta_preview_required: true,
    unsafe_auto_merge: false,
  };
}

export function writeMergePlanFile(plan: MergePlan, outputPath: string): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
}
