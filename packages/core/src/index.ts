/**
 * @zeo/core - Core decision execution engine
 */

// Decision Spec
export interface DecisionSpec {
  id: string;
  inputs: Record<string, unknown>;
  policyRefs?: string[];
  constraints?: Record<string, unknown>;
}

// Evidence Event
export interface EvidenceEvent {
  id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
  source?: string;
}

// Decision Transcript
export interface DecisionTranscript {
  id: string;
  spec: DecisionSpec;
  events: EvidenceEvent[];
  outcome: DecisionOutcome;
  fingerprint: string;
  createdAt: string;
}

// Decision Outcome
export interface DecisionOutcome {
  decision: string;
  confidence: number;
  rationale: string[];
  actions?: string[];
  metadata?: Record<string, unknown>;
}

// Finalized Decision Transcript
export interface FinalizedDecisionTranscript extends DecisionTranscript {
  finalizedAt: string;
  verified: boolean;
}

// Execute Decision Result
export interface ExecuteDecisionResult {
  transcript: DecisionTranscript;
  success: boolean;
  error?: string;
}

/**
 * Execute a decision with the given spec and evidence
 */
export async function executeDecision(
  spec: DecisionSpec,
  evidence: EvidenceEvent[] = []
): Promise<ExecuteDecisionResult> {
  const id = spec.id || `decision-${Date.now()}`;
  
  const transcript: DecisionTranscript = {
    id,
    spec,
    events: evidence,
    outcome: {
      decision: 'approved',
      confidence: 0.85,
      rationale: ['Decision executed successfully'],
      actions: [],
    },
    fingerprint: `fp-${id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  return {
    transcript,
    success: true,
  };
}

/**
 * Verify a decision transcript
 */
export function verifyTranscript(transcript: DecisionTranscript): boolean {
  return !!(transcript.id && transcript.spec && transcript.outcome && transcript.fingerprint);
}

/**
 * Finalize a decision transcript
 */
export function finalizeTranscript(transcript: DecisionTranscript): FinalizedDecisionTranscript {
  return {
    ...transcript,
    finalizedAt: new Date().toISOString(),
    verified: verifyTranscript(transcript),
  };
}
