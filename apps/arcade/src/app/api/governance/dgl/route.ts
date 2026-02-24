import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/cloud-auth';
import { authFailurePayload, buildDglPayload } from '@/lib/dgl-governance-api';

export const runtime = 'nodejs';

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) {
    return NextResponse.json(authFailurePayload(), { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const root = process.cwd();
    const reportPath = path.join(root, 'dgl', 'reports', 'dgl_report.json');
    const matrixPath = path.join(root, 'dgl', 'reports', 'provider-matrix.json');

    const report = safeReadJson<Record<string, unknown> | null>(reportPath, null);
    const matrixRaw = safeReadJson<Array<Record<string, unknown>>>(matrixPath, []);

    return NextResponse.json({
      ok: true,
      data: buildDglPayload(report, matrixRaw, {
        provider: url.searchParams.get('provider') ?? '',
        branch: url.searchParams.get('branch') ?? '',
        subsystem: url.searchParams.get('subsystem') ?? '',
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'DGL_REPORT_READ_FAILED',
          message: 'Unable to load divergence governance report data.',
          details: error instanceof Error ? error.message : 'unknown',
        },
      },
      { status: 200 },
    );
  }
}
