import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_SOURCES = new Set(['primary', 'footer', 'navbar']);

export function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get('source') ?? 'primary';
  const safeSource = ALLOWED_SOURCES.has(source) ? source : 'primary';

  const target = new URL('https://ready-layer.com');
  target.searchParams.set('utm_source', 'reach_cli');
  target.searchParams.set('utm_medium', 'enterprise_cta');
  target.searchParams.set('utm_campaign', safeSource);

  return NextResponse.redirect(target, { status: 307 });
}
