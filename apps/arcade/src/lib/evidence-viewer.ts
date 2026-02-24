export interface EvidenceEvent {
  id: string;
  timestamp: string;
  type: string;
  stepId?: string;
  message: string;
  proofHash?: string;
}

export interface EvidenceBundle {
  run: {
    id: string;
    pack: string;
    startedAt: string;
    status: string;
    engineVersion: string;
    fingerprint?: string;
  };
  events: EvidenceEvent[];
  verify: {
    whatIsVerified: string[];
    whatIsNotVerified: string[];
  };
}

export interface AdapterResult {
  ok: boolean;
  mode: 'cli' | 'static';
  summary: string;
  details?: Record<string, unknown>;
  divergence?: string;
  installHint?: string;
}
