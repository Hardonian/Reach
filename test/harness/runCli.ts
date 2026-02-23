import { execFile } from "node:child_process";
import { resolve } from "node:path";

export interface CliResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

const REACH_CLI = resolve(process.cwd(), "reach");

export async function runCli(
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      REACH_CLI,
      args,
      {
        cwd: options?.cwd || process.cwd(),
        env: {
          ...process.env,
          ...options?.env,
          NODE_ENV: "test",
        },
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout,
          stderr,
          code: error?.code ?? 0,
        });
      }
    );
  });
}

export async function runCliJson(
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<{ ok: boolean; data: any; stderr: string }> {
  const result = await runCli([...args], options);
  if (!result.stdout) {
    return { ok: result.ok, data: null, stderr: result.stderr };
  }

  try {
    const data = JSON.parse(result.stdout);
    return { ok: result.ok, data, stderr: result.stderr };
  } catch (parseError: any) {
    return { ok: false, data: null, stderr: `JSON parse error: ${parseError.message}\n${result.stderr}` };
  }
}
