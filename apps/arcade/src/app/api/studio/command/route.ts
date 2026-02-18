import { NextResponse } from 'next/server';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface StudioCommandResult {
  command: string;
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  runId?: string;
}

const RUN_SCOPED_COMMANDS = new Set([
  'packs.sign',
  'runs.explain',
  'graph.export',
  'proof.verify',
  'capsule.create',
]);

const COMMAND_BUILDERS: Record<string, (runId?: string) => string[]> = {
  'packs.init': () => ['init', 'pack', '--governed'],
  'packs.validate': () => ['packs', 'verify'],
  'packs.sign': (runId) => ['proof', 'verify', runId || ''],
  'packs.verify': () => ['packs', 'verify'],
  'runs.list': () => ['operator'],
  'runs.inventory': () => ['operator'],
  'runs.explain': (runId) => ['explain', runId || ''],
  'graph.export': (runId) => ['graph', 'export', runId || '', '--format=json'],
  'replay.verify': () => ['capsule', 'verify'],
  'federation.status': () => ['federation', 'status', '--format=json'],
  'federation.map': () => ['federation', 'map', '--format=svg'],
  'marketplace.search': () => ['packs', 'search'],
  'marketplace.install': () => ['packs', 'install', 'arcadeSafe.demo'],
  'arena.run': () => ['arena', 'run', 'baseline'],
  'playground.export': () => ['playground', 'export'],
  'proof.verify': (runId) => ['proof', 'verify', runId || ''],
  'capsule.create': (runId) => ['capsule', 'create', runId || ''],
  'capsule.replay': () => ['capsule', 'replay'],
};

export async function listRunInventory(repoRoot: string): Promise<string[]> {
  const runsDir = path.join(repoRoot, 'services', 'runner', 'data', 'runs');
  const entries = await fs.readdir(runsDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.replace(/\.json$/u, ''))
    .sort((a, b) => a.localeCompare(b));
}

export async function executeStudioCommand(command: string, repoRoot: string, runId?: string): Promise<StudioCommandResult> {
  const runnerDir = path.join(repoRoot, 'services', 'runner');
  const args = COMMAND_BUILDERS[command](runId).filter(Boolean);

  const result = spawnSync('go', ['run', './cmd/reachctl', ...args], {
    cwd: runnerDir,
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      GOWORK: 'off',
    },
  });

  return {
    command,
    ok: result.status === 0,
    code: result.status ?? -1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    runId,
  };
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { command?: string; runId?: string };
  const command = payload.command || '';

  if (!COMMAND_BUILDERS[command]) {
    return NextResponse.json({ error: 'unsupported command' }, { status: 400 });
  }

  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const inventory = await listRunInventory(repoRoot);

  if (command === 'runs.inventory') {
    return NextResponse.json({ command, ok: true, code: 0, runs: inventory });
  }

  const requestedRunId = payload.runId?.trim();
  const resolvedRunId = RUN_SCOPED_COMMANDS.has(command) ? requestedRunId || inventory[0] : undefined;

  if (RUN_SCOPED_COMMANDS.has(command) && !resolvedRunId) {
    return NextResponse.json({
      command,
      ok: false,
      code: 1,
      stderr: 'No run records available. Create a run before calling run-scoped commands.',
      stdout: '',
      runId: '',
    });
  }

  const output = await executeStudioCommand(command, repoRoot, resolvedRunId);
  return NextResponse.json(output);
}
