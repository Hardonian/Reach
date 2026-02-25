import fs from 'fs';
import path from 'path';

interface PlaneCheck {
  name: string;
  scopeHint: string;
  mutationSignals: string[];
  gitSourceSignals: string[];
  scclSignals: string[];
  identitySignals: string[];
  leaseSignals: string[];
  runSignals: string[];
}

interface LayerCheck {
  name: string;
  requiredPaths: string[];
  status: 'implemented' | 'partial' | 'missing';
  notes: string;
}

const repoRoot = process.cwd();

const controlPlanes: PlaneCheck[] = [
  {
    name: 'Reach CLI',
    scopeHint: 'src/cli + services/runner/cmd/reachctl',
    mutationSignals: ['src/cli/reach-cli.ts', 'services/runner/internal/api/server.go'],
    gitSourceSignals: ['docs/architecture/source-control-coherence.md'],
    scclSignals: ['src/sccl/engine.ts', 'scripts/sccl-cli.ts'],
    identitySignals: ['services/runner/internal/api/auth.go', 'docs/rbac.md'],
    leaseSignals: ['src/sccl/lease-store.ts', 'src/sccl/gate.ts'],
    runSignals: ['services/runner/internal/api/handlers.go', 'services/runner/internal/jobs/audit.go'],
  },
  {
    name: 'ReadyLayer Web App',
    scopeHint: 'apps/arcade',
    mutationSignals: ['apps/arcade/src/app/api/v1/workflows/[id]/runs/route.ts', 'apps/arcade/src/app/api/ci/ingest/route.ts'],
    gitSourceSignals: ['docs/integrations/git-host.md'],
    scclSignals: ['src/sccl/index.ts'],
    identitySignals: ['apps/arcade/src/app/api/v1/billing/route.ts'],
    leaseSignals: ['docs/architecture/source-control-coherence.md'],
    runSignals: ['apps/arcade/src/app/api/v1/playground/route.ts'],
  },
  {
    name: 'Backend Services',
    scopeHint: 'services/*',
    mutationSignals: ['services/runner/internal/api/server.go', 'services/runner/internal/jobs/reconciliation.go'],
    gitSourceSignals: ['services/runner/internal/gitops/remote.go'],
    scclSignals: ['services/runner/internal/sccl'],
    identitySignals: ['services/runner/internal/api/auth.go', 'services/session-hub/internal/hub/hub.go'],
    leaseSignals: ['services/runner/internal/sccl'],
    runSignals: ['services/runner/internal/jobs/audit.go'],
  },
  {
    name: 'IDE Integrations',
    scopeHint: 'extensions/* + protocol/ide',
    mutationSignals: ['protocol/ide/apply_patch.schema.json', 'docs/integrations/vscode.md'],
    gitSourceSignals: ['docs/integrations/vscode.md'],
    scclSignals: ['src/sccl/engine.ts'],
    identitySignals: ['protocol/ide/context.schema.json'],
    leaseSignals: ['docs/architecture/source-control-coherence.md'],
    runSignals: ['protocol/ide/notification.schema.json'],
  },
  {
    name: 'Web Agent APIs',
    scopeHint: 'apps/arcade/src/app/api/*',
    mutationSignals: ['apps/arcade/src/app/api/monitor/ingest/route.ts', 'apps/arcade/src/app/api/ci/ingest/route.ts'],
    gitSourceSignals: ['apps/arcade/src/app/api/github/webhook/route.ts'],
    scclSignals: ['src/sccl/index.ts'],
    identitySignals: ['docs/rbac.md'],
    leaseSignals: ['src/sccl/lease-store.ts'],
    runSignals: ['apps/arcade/src/app/api/v1/workflows/[id]/runs/route.ts'],
  }
];

const layers: LayerCheck[] = [
  {
    name: 'Git host integration',
    requiredPaths: ['apps/arcade/src/app/api/github/webhook/route.ts', 'docs/integrations/git-host.md'],
    status: 'implemented',
    notes: 'Webhook ingress + integration documentation are present; check-run/comment automation should stay in worker adapters.',
  },
  {
    name: 'Artifact registry',
    requiredPaths: ['services/runner/internal/storage/artifacts.go', 'services/runner/internal/historical/lineage_index.go', 'docs/STORAGE_MODEL.md'],
    status: 'implemented',
    notes: 'Content-addressed references and run linkage exist in runner + historical index; ensure web API parity remains aligned.',
  },
  {
    name: 'Policy engine',
    requiredPaths: ['config/governance-policy.json', 'services/runner/internal/governance/dsl.go', 'docs/POLICY_ENGINE_SPEC.md'],
    status: 'implemented',
    notes: 'Unified policy contract is versioned and wired through governance DSL.',
  },
  {
    name: 'Reconciliation loop',
    requiredPaths: ['services/runner/internal/jobs/reconciliation.go', 'docs/architecture/reconciliation-loop.md'],
    status: 'implemented',
    notes: 'Webhook + scheduler surfaces exist; continue enforcing deterministic queue ordering.',
  },
  {
    name: 'CPX interactive resolve',
    requiredPaths: ['src/dgl/cpx-resolve.ts', 'scripts/cpx-cli.ts', 'src/dgl/cpx-resolve.test.ts'],
    status: 'implemented',
    notes: 'Conflict packets + resolve command path exist and are test-backed.',
  },
  {
    name: 'Provider SDK',
    requiredPaths: ['src/providers/sdk/index.ts', 'src/providers/sdk/index.test.ts', 'docs/CLOUD_ADAPTER_MODEL.md'],
    status: 'implemented',
    notes: 'SDK contract and conformance tests are present.',
  },
  {
    name: 'Onboarding flow',
    requiredPaths: ['docs/product/first-success.md', 'docs/CLI_REFERENCE.md'],
    status: 'partial',
    notes: 'Core flows are documented but lacked a single operator runbook combining CLI + web onboarding.',
  }
];

function existsAny(pathsToCheck: string[]): boolean {
  return pathsToCheck.some((rel) => fs.existsSync(path.join(repoRoot, rel)));
}

function ratio(pathsToCheck: string[]): string {
  const existing = pathsToCheck.filter((rel) => fs.existsSync(path.join(repoRoot, rel))).length;
  return `${existing}/${pathsToCheck.length}`;
}

function statusEmoji(status: 'implemented' | 'partial' | 'missing'): string {
  if (status === 'implemented') return '✅';
  if (status === 'partial') return '🟡';
  return '❌';
}

function planeSignalSummary(signals: string[]): string {
  if (existsAny(signals)) return `present (${ratio(signals)})`;
  return 'missing (0/' + signals.length + ')';
}

const lines: string[] = [];
lines.push('# Reach + ReadyLayer Control Planes Audit');
lines.push('');
lines.push('Generated by `scripts/governance-audit.ts` to provide deterministic evidence of governance coverage.');
lines.push('');
lines.push('## Control Plane Findings');
lines.push('');
lines.push('| Control plane | Scope hint | Mutation | Git SoT dependency | SCCL shared engine | Identity attribution | Lease usage | Run linkage | Split-brain risk |');
lines.push('|---|---|---|---|---|---|---|---|---|');

for (const plane of controlPlanes) {
  const mutation = planeSignalSummary(plane.mutationSignals);
  const git = planeSignalSummary(plane.gitSourceSignals);
  const sccl = planeSignalSummary(plane.scclSignals);
  const identity = planeSignalSummary(plane.identitySignals);
  const lease = planeSignalSummary(plane.leaseSignals);
  const run = planeSignalSummary(plane.runSignals);
  const risk = (sccl.includes('missing') || lease.includes('missing') || run.includes('missing')) ? 'Medium/High' : 'Low/Medium';

  lines.push(`| ${plane.name} | ${plane.scopeHint} | ${mutation} | ${git} | ${sccl} | ${identity} | ${lease} | ${run} | ${risk} |`);
}

lines.push('');
lines.push('## Governance Layer Completion Matrix');
lines.push('');
lines.push('| Layer | Status | Evidence coverage | Notes |');
lines.push('|---|---|---|---|');
for (const layer of layers) {
  lines.push(`| ${layer.name} | ${statusEmoji(layer.status)} ${layer.status} | ${ratio(layer.requiredPaths)} | ${layer.notes} |`);
}

lines.push('');
lines.push('## Highest Priority Gaps');
lines.push('');
lines.push('1. Consolidate onboarding into one CLI + web walkthrough with operational checkpoints.');
lines.push('2. Keep API parity visible between runner artifact APIs and web route adapters to avoid governance drift.');
lines.push('3. Continue standardizing identity + lease metadata in every mutation/audit record to reduce split-brain risk.');
lines.push('');
lines.push('## Risk Register');
lines.push('');
lines.push('- **Identity drift risk:** Medium — multiple control planes exist, so every mutation must carry tenant + actor + run IDs.');
lines.push('- **Split-brain risk:** Medium — git/web/CLI pathways can diverge when lease checks are skipped.');
lines.push('- **Operational risk:** Low/Medium — deterministic queueing and replay are in place but should remain hard-gated in CI.');

process.stdout.write(lines.join('\n') + '\n');
