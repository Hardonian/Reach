export interface GovernanceApplyGuardInput {
  action: "preview" | "apply";
  compiledSpecHash: string;
  previewSpecHash?: string;
}

export interface GovernanceApplyGuardError {
  code: "GOV_APPLY_PREVIEW_REQUIRED" | "GOV_APPLY_PREVIEW_STALE";
  message: string;
  hint: string;
}

export function validateGovernanceApplyGuard(
  input: GovernanceApplyGuardInput,
): GovernanceApplyGuardError | null {
  if (input.action !== "apply") return null;

  const previewSpecHash = input.previewSpecHash?.trim();
  if (!previewSpecHash) {
    return {
      code: "GOV_APPLY_PREVIEW_REQUIRED",
      message: "Apply requires an explicit preview acknowledgement",
      hint: "Run preview first and resubmit apply with preview_spec_hash.",
    };
  }

  if (previewSpecHash !== input.compiledSpecHash) {
    return {
      code: "GOV_APPLY_PREVIEW_STALE",
      message: "Preview hash mismatch. Governance intent changed since preview.",
      hint: "Re-run preview and apply the latest spec hash.",
    };
  }

  return null;
}
