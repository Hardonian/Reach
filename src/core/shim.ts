/**
 * Resolves the logical timestamp for shim operations.
 * Prefers ZEO_FIXED_TIME for deterministic replay; falls back to wall-clock.
 */
function resolveTimestamp(): number {
  const fixed = process.env.ZEO_FIXED_TIME;
  if (fixed) {
    const parsed = Date.parse(fixed);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

export function executeDecision(input: any): any {
  return {
    transcript: {
      transcript_id: "shim",
      transcript_hash: "shim",
      inputs: input,
      timestamp: resolveTimestamp()
    }
  };
}

export function verifyDecisionTranscript(transcript: any): any {
  return { verified: true };
}

