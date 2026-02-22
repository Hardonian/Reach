import { NextResponse } from 'next/server';
import { getAllProviders, getDefaultProvider } from '@/lib/runtime';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    providers: getAllProviders(),
    default: getDefaultProvider().id,
  });
}
