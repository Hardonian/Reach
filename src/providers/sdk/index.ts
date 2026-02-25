export interface ProviderPatchPack {
  pack_version: '1.0';
  provider: string;
  model: string;
  agent_id: string;
  base_sha: string;
  head_sha: string;
  diff: { format: 'git'; content: string };
  changed_paths: string[];
  metadata: {
    confidence: number;
    risk_summary: string;
    context_hash: string;
    claimed_invariants_changed: string[];
    requires_acknowledgement: boolean;
  };
  artifacts: Record<string, string | undefined>;
}

export interface AdapterTelemetry {
  latency_ms: number;
  retries: number;
  status: 'ok' | 'degraded' | 'failed';
}

export interface AdapterTokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface AdapterAocMetadata {
  actor: string;
  operation: string;
  context: Record<string, string>;
}

export interface ProviderAdapter {
  readonly providerId: string;
  generatePatchPack(input: {
    baseSha: string;
    headSha: string;
    diff: string;
    changedPaths: string[];
    model: string;
    agentId: string;
  }): Promise<ProviderPatchPack>;
  getAocMetadata(): AdapterAocMetadata;
  getTelemetry(): AdapterTelemetry;
  getTokenUsage(): AdapterTokenUsage;
}

export class ProviderAdapterRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  get(providerId: string): ProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`Provider adapter not found: ${providerId}`);
    }
    return adapter;
  }

  list(): string[] {
    return [...this.adapters.keys()].sort();
  }
}

export class ExampleDeterministicAdapter implements ProviderAdapter {
  readonly providerId = 'example-deterministic';

  async generatePatchPack(input: {
    baseSha: string;
    headSha: string;
    diff: string;
    changedPaths: string[];
    model: string;
    agentId: string;
  }): Promise<ProviderPatchPack> {
    return {
      pack_version: '1.0',
      provider: this.providerId,
      model: input.model,
      agent_id: input.agentId,
      base_sha: input.baseSha,
      head_sha: input.headSha,
      diff: { format: 'git', content: input.diff },
      changed_paths: [...input.changedPaths].sort(),
      metadata: {
        confidence: 0.75,
        risk_summary: 'Deterministic example adapter output',
        context_hash: `${input.baseSha}:${input.headSha}`,
        claimed_invariants_changed: [],
        requires_acknowledgement: false,
      },
      artifacts: {},
    };
  }

  getAocMetadata(): AdapterAocMetadata {
    return {
      actor: 'provider:example-deterministic',
      operation: 'generate_patch_pack',
      context: { deterministic: 'true' },
    };
  }

  getTelemetry(): AdapterTelemetry {
    return {
      latency_ms: 0,
      retries: 0,
      status: 'ok',
    };
  }

  getTokenUsage(): AdapterTokenUsage {
    return {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };
  }
}
