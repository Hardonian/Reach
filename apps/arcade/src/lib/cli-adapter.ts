import { spawn } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import type { AdapterResult } from '@/lib/evidence-viewer';

const CLI_TIMEOUT_MS = 15000;
const ALLOWED = new Set(['doctor', 'verify-determinism', 'replay']);

function resolveCliPath(): string | null {
  const envPath = process.env.REACHCTL_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  const localBuild = path.resolve(process.cwd(), '../services/runner/reachctl');
  if (existsSync(localBuild)) return localBuild;

  return 'reachctl';
}

export async function runReachCli(command: string, args: string[]): Promise<AdapterResult> {
  if (!ALLOWED.has(command)) {
    return { ok: false, mode: 'static', summary: 'Blocked by command allowlist.' };
  }

  const cli = resolveCliPath();
  if (!cli) {
    return {
      ok: false,
      mode: 'static',
      summary: 'Reach CLI is unavailable.',
      installHint: 'Run ./scripts/install.sh (macOS/Linux) or ./scripts/install.ps1 (Windows).'
    };
  }

  return new Promise((resolve) => {
    const child = spawn(cli, [command, ...args, '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' }
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), CLI_TIMEOUT_MS);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', () => {
      clearTimeout(timer);
      resolve({
        ok: false,
        mode: 'static',
        summary: 'Reach CLI is not installed in this environment.',
        installHint: 'Run ./scripts/install.sh (macOS/Linux) or ./scripts/install.ps1 (Windows).'
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ ok: false, mode: 'static', summary: 'CLI command failed.', details: { stderr: stderr.trim() } });
        return;
      }

      try {
        resolve({ ok: true, mode: 'cli', summary: `CLI command '${command}' completed.`, details: JSON.parse(stdout) });
      } catch {
        resolve({ ok: false, mode: 'static', summary: 'CLI output was not valid JSON.', details: { stdout: stdout.trim() } });
      }
    });
  });
}
