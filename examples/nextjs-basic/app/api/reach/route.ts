/**
 * Next.js App Router API Route for Reach
 * 
 * This route handler proxies requests to the Reach server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createReachClient } from '@reach/sdk';

const client = createReachClient({
  baseUrl: process.env.REACH_BASE_URL || 'http://127.0.0.1:8787',
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'health':
        const health = await client.health();
        return NextResponse.json(health);

      case 'federation':
        const federation = await client.getFederationStatus();
        return NextResponse.json(federation);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Reach server error' },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    const body = await request.json();

    switch (action) {
      case 'create-run':
        const run = await client.createRun(body);
        return NextResponse.json(run, { status: 201 });

      case 'create-capsule':
        const capsule = await client.createCapsule(body.run_id);
        return NextResponse.json(capsule, { status: 201 });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Reach server error' },
      { status: 503 }
    );
  }
}
