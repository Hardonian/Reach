export interface DecisionSpec {
  id: string;
  title: string;
  context: string;
  createdAt: string;
  horizon: string;
  agents: any[];
  actions: any[];
  constraints: any[];
  assumptions: any[];
  objectives: any[];
}

export interface EvidenceEvent {
  id: string;
  type: string;
  sourceId: string;
  capturedAt: string;
  checksum: string;
  observations: string[];
  claims: any[];
  constraints: any[];
}

export interface FinalizedDecisionTranscript {
  transcript_id: string;
  transcript_hash: string;
  inputs: any;
  timestamp: number;
}

export interface ReplayDataset {
  id: string;
  specs: DecisionSpec[];
}

export interface ReplayResult {
  success: boolean;
  message?: string;
}

export type DashboardPersona = "exec" | "tech" | "security";

export interface DashboardGraphEdge {
  from: string;
  to: string;
  type: "supports" | "violates" | "constrains" | "depends_on";
  weight: number;
}

export interface DashboardViewModel {
  schemaVersion: string;
  id: string;
  generatedAt: string;
  persona: DashboardPersona;
  verificationStatus: { verified: boolean; reason: string };
  fingerprint: {
    zeoVersion: string;
    configHash: string;
    policyHash: string | null;
    inputsHash: string;
    artifactsHash: string;
  };
  summary: {
    riskScore: number;
    evidenceCompleteness: number;
    policyCompliance: number;
    replayStability: number;
    confidenceBand: "low" | "med" | "high";
  };
  story: {
    mode: string;
    statusLine: string;
    changeLine: string;
    causeLine: string;
    actionLine: string;
  };
  trends: {
    riskTrajectory: Array<{ t: string; v: number; source: string }>;
    driftEvents: Array<{
      t: string;
      type: "policy" | "evidence";
      severity: 1 | 2 | 3 | 4 | 5;
      refId: string;
    }>;
    assumptionFlips: Array<{
      t: string;
      assumptionId: string;
      from: string;
      to: string;
      severity: 1 | 2 | 3 | 4 | 5;
    }>;
  };
  graph: {
    nodes: DashboardGraphNode[];
    edges: DashboardGraphEdge[];
  };
  lists: {
    findings: Array<Record<string, unknown>>;
    evidence: Array<Record<string, unknown>>;
    policies: Array<Record<string, unknown>>;
  };
  ctas: Array<{
    command: string;
    label: string;
    severity?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface DashboardGraphNode {
  id: string;
  type: "decision" | "evidence" | "policy" | "assumption" | "outcome";
  label: string;
  severity?: number;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Reach SDK - TypeScript client for deterministic execution fabric
 * @module @reach/sdk
 */

// Types
export interface ReachClientConfig {
  /** Base URL for the Reach API */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

export interface Run {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  tier?: string;
  capabilities?: string[];
  created_at: string;
  completed_at?: string;
}

export interface Event {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CapsuleManifest {
  spec_version: string;
  run_id: string;
  run_fingerprint: string;
  registry_snapshot_hash?: string;
  pack?: Record<string, unknown>;
  policy?: Record<string, unknown>;
  federation_path?: string[];
  trust_scores?: Record<string, number>;
  audit_root?: string;
  environment?: Record<string, string>;
  created_at: string;
}

export interface Capsule {
  manifest: CapsuleManifest;
  event_log: Record<string, unknown>[];
}

export interface Pack {
  name: string;
  repo: string;
  spec_version: string;
  signature?: string;
  reproducibility?: "A" | "B" | "C" | "D" | "F";
  verified: boolean;
}

export interface FederationNode {
  node_id: string;
  status: "active" | "inactive" | "quarantined";
  capabilities?: string[];
  latency_ms?: number;
  load_score?: number;
  trust_score?: number;
  quarantined?: boolean;
}

export interface VerificationResult {
  verified: boolean;
  name?: string;
  signature_valid?: boolean;
  spec_compatible?: boolean;
  run_id?: string;
  run_fingerprint?: string;
  recomputed_fingerprint?: string;
  audit_root?: string;
}

export interface ReachError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  remediation?: string;
}

export class ReachErrorException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
    public readonly remediation?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "ReachErrorException";
  }
}

// Client implementation
class ReachClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ReachClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "http://127.0.0.1:8787").replace(
      /\/$/,
      "",
    );
    this.timeout = config.timeout ?? 30000;
    this.fetchImpl = config.fetch ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as Partial<ReachError>;
        throw new ReachErrorException(
          errorData.error ?? `HTTP ${response.status}`,
          errorData.code ?? "UNKNOWN_ERROR",
          errorData.details,
          errorData.remediation,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ReachErrorException) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new ReachErrorException(
          "Request timeout",
          "TIMEOUT",
          undefined,
          "Increase timeout or check server availability",
        );
      }
      throw new ReachErrorException(
        error instanceof Error ? error.message : "Unknown error",
        "NETWORK_ERROR",
        undefined,
        "Check network connectivity and server status",
      );
    }
  }

  // System
  async health(): Promise<{ status: string; version: string }> {
    return this.request("GET", "/health");
  }

  async version(): Promise<{
    apiVersion: string;
    specVersion: string;
    compatibilityPolicy: string;
    supportedVersions: string[];
  }> {
    return this.request("GET", "/version");
  }

  // Runs
  async createRun(params?: {
    capabilities?: string[];
    plan_tier?: string;
  }): Promise<Run> {
    return this.request("POST", "/runs", params);
  }

  async getRun(id: string): Promise<Run> {
    return this.request("GET", `/runs/${encodeURIComponent(id)}`);
  }

  async getRunEvents(id: string, after?: number): Promise<{ events: Event[] }> {
    const query = after ? `?after=${after}` : "";
    return this.request(
      "GET",
      `/runs/${encodeURIComponent(id)}/events${query}`,
    );
  }

  async streamRunEvents(
    id: string,
    onEvent: (event: Event) => void,
    onError?: (error: Error) => void,
  ): Promise<() => void> {
    const url = `${this.baseUrl}/runs/${encodeURIComponent(id)}/events`;
    const controller = new AbortController();

    try {
      const response = await this.fetchImpl(url, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ReachErrorException(
          `HTTP ${response.status}`,
          "STREAM_ERROR",
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new ReachErrorException("No response body", "STREAM_ERROR");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const event = JSON.parse(line.slice(6)) as Event;
                  onEvent(event);
                } catch {
                  // Ignore parse errors for malformed events
                }
              }
            }
          }
        } catch (error) {
          if (onError && error instanceof Error) {
            onError(error);
          }
        }
      };

      processStream();
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    }

    return () => controller.abort();
  }

  async replayRun(id: string): Promise<{
    run_id: string;
    replay_verified: boolean;
    steps: number;
    policy?: Record<string, unknown>;
  }> {
    return this.request("POST", `/runs/${encodeURIComponent(id)}/replay`);
  }

  // Capsules
  async createCapsule(
    runId: string,
  ): Promise<Capsule & { capsulePath: string }> {
    return this.request("POST", "/capsules", { run_id: runId });
  }

  async verifyCapsule(path: string): Promise<VerificationResult> {
    return this.request("POST", "/capsules/verify", { path });
  }

  // Federation
  async getFederationStatus(): Promise<{ nodes: FederationNode[] }> {
    return this.request("GET", "/federation/status");
  }

  // Packs
  async searchPacks(query?: string): Promise<{ results: Pack[] }> {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    return this.request("GET", `/packs${q}`);
  }

  async installPack(name: string): Promise<{
    installed: string;
    path: string;
    verified_badge: boolean;
  }> {
    return this.request("POST", "/packs/install", { name });
  }

  async verifyPack(name: string): Promise<VerificationResult> {
    return this.request("POST", "/packs/verify", { name });
  }
}

// Export factory function
export function createReachClient(config?: ReachClientConfig): ReachClient {
  return new ReachClient(config);
}

// Default export
export default ReachClient;
