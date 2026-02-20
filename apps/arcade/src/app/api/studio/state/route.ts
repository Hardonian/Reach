import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

interface StudioState {
  packDraft: {
    name: string;
    specVersion: string;
    policyContract: string;
    tests: string[];
  };
  runHistory: Array<{
    command: string;
    timestamp: string;
    runId?: string;
    ok: boolean;
  }>;
}

const DEFAULT_STATE: StudioState = {
  packDraft: {
    name: 'governed-starter',
    specVersion: '1.0',
    policyContract: 'policy/default.contract.json',
    tests: ['tests/conformance.policy.json'],
  },
  runHistory: [],
};

function statePath() {
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  return path.join(repoRoot, 'apps', 'arcade', '.studio-state.json');
}

async function readState(): Promise<StudioState> {
  const target = statePath();
  const data = await fs.readFile(target, 'utf8').catch(() => '');
  if (!data) {
    return DEFAULT_STATE;
  }
  try {
    const parsed = JSON.parse(data) as StudioState;
    return {
      packDraft: parsed.packDraft || DEFAULT_STATE.packDraft,
      runHistory: parsed.runHistory || [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeState(state: StudioState) {
  const target = statePath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export async function GET() {
  const state = await readState();
  return NextResponse.json({ state });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { state?: StudioState };
  if (!body.state) {
    return NextResponse.json({ error: 'state required' }, { status: 400 });
  }
  await writeState(body.state);
  return NextResponse.json({ ok: true });
}
