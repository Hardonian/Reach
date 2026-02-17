import { Pack } from '@/lib/packs';
import Link from 'next/link';
import { TimelineEvent } from '@/components/ExecutionTimeline';

interface SharePayload {
  pack: Pack;
  timeline: TimelineEvent[];
  timestamp: number;
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let data: SharePayload | null = null;
  let error: string | null = null;

  if (token) {
    try {
      // Decode base64
      const json = atob(token);
      data = JSON.parse(json);
    } catch (e) {
      error = 'Invalid share token.';
    }
  } else {
    error = 'No token provided.';
  }

  if (error || !data) {
    return (
      <div className="container center-screen">
        <h1 className="font-bold mb-2 text-error">Error</h1>
        <p className="text-secondary mb-6">{error || 'Unknown error'}</p>
        <Link href="/" className="btn-primary">
          Return to Arcade
        </Link>
      </div>
    );
  }

  const { pack, timeline, timestamp } = data;

  return (
    <div className="container page-container">
      <header className="share-header">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-lg font-bold text-gradient">SHARED RUN CARD</h1>
          <Link href="/" className="text-sm text-secondary hover:text-white">
            Open Arcade
          </Link>
        </div>
        <div className="font-mono text-xs text-tertiary">
          Run ID: {timeline.find(e => e.type === 'Initializing')?.timestamp || 'unknown'} • {new Date(timestamp).toLocaleString()}
        </div>
      </header>

      <div className="card">
        <h2 className="text-xl font-bold mb-2">{pack.name}</h2>
        <p className="text-secondary text-sm mb-4">{pack.description}</p>
        
        <div className="code-block">
          {timeline.map((ev, i) => (
            <div key={i} className="timeline-log-entry">
              <div className="flex gap-2">
                <span className={ev.status === 'failed' ? 'text-error' : 'text-success'}>
                   {ev.type}
                </span>
                <span className="text-tertiary">
                  {ev.timestamp ? `(${ev.timestamp - timestamp}ms)` : ''}
                </span>
              </div>
              {ev.details && <div className="text-secondary mt-1">{ev.details}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <Link 
          href="/"
          className="btn-primary btn-large"
        >
          PLAY THIS PACK
        </Link>
      </div>
    </div>
  );
}
