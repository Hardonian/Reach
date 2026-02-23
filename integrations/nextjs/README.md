# Reach Next.js Integration Integration kit for using Reach with Next.js App Router.

## Setup ```bash

npm install @reach/sdk

````

## Environment Variables ```env
REACH_BASE_URL=http://127.0.0.1:8787
````

## API Route Handler Create `app/api/reach/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createReachClient } from "@reach/sdk";

const client = createReachClient({
  baseUrl: process.env.REACH_BASE_URL || "http://127.0.0.1:8787",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const run = await client.createRun(body);
    return NextResponse.json(run);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create run" },
      { status: 500 },
    );
  }
}
```

## Page Component Create `app/runs/page.tsx`:

```tsx
import { createReachClient } from "@reach/sdk";

const client = createReachClient();

export default async function RunsPage() {
  const health = await client.health();

  return (
    <div>
      <h1>Reach Status</h1>
      <p>Status: {health.status}</p>
      <p>Version: {health.version}</p>
    </div>
  );
}
```

## Client Component with Streaming ```tsx

'use client';

import { useEffect, useState } from 'react';
import { createReachClient } from '@reach/sdk';

const client = createReachClient();

export function RunEvents({ runId }: { runId: string }) {
const [events, setEvents] = useState<any[]>([]);

useEffect(() => {
const unsubscribe = client.streamRunEvents(
runId,
(event) => setEvents((prev) => [...prev, event]),
(error) => console.error('Stream error:', error)
);

    return () => {
      unsubscribe.then((fn) => fn());
    };

}, [runId]);

return (

<ul>
{events.map((event) => (
<li key={event.id}>{event.type}</li>
))}
</ul>
);
}

```

## License Apache 2.0
```
