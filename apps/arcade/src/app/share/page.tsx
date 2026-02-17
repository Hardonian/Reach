import { Pack } from '@/lib/packs';
import Link from 'next/link';

interface SharePayload {
  pack: Pack;
  timeline: any[];
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-[var(--error)] mb-2">Error</h1>
        <p className="text-gray-400 mb-6">{error || 'Unknown error'}</p>
        <Link href="/" className="px-6 py-2 bg-[var(--surface-highlight)] rounded-lg">
          Return to Arcade
        </Link>
      </div>
    );
  }

  const { pack, timeline, timestamp } = data;

  return (
    <div className="min-h-screen p-4 pb-24">
      <header className="mb-8 border-b border-[var(--border)] pb-4">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-bold text-[var(--primary)]">SHARED RUN CARD</h1>
          <Link href="/" className="text-sm text-[var(--secondary)] hover:underline">
            Open Arcade
          </Link>
        </div>
        <div className="font-mono text-xs text-gray-500">
          Run ID: {timeline.find(e => e.id)?.id || 'unknown'} • {new Date(timestamp).toLocaleString()}
        </div>
      </header>

      <div className="card border-[var(--secondary)] mb-6">
        <h2 className="text-2xl font-bold mb-2">{pack.name}</h2>
        <p className="text-gray-300 mb-4">{pack.description}</p>
        
        <div className="bg-black/40 p-4 rounded-lg font-mono text-xs max-h-[60vh] overflow-y-auto">
          {timeline.map((ev, i) => (
            <div key={i} className="mb-2 border-l-2 border-[var(--surface-highlight)] pl-2">
              <div className="flex gap-2">
                <span className={ev.status === 'failed' ? 'text-[var(--error)]' : 'text-[var(--success)]'}>
                   {ev.type}
                </span>
                <span className="text-gray-500">
                  {ev.duration ? `(${ev.duration}ms)` : ''}
                </span>
              </div>
              {ev.details && <div className="text-gray-400 mt-1">{ev.details}</div>}
              {ev.output && (
                 <div className="mt-1 text-gray-300 bg-[var(--surface-highlight)] p-1 rounded">
                   {typeof ev.output === 'object' ? JSON.stringify(ev.output) : String(ev.output)}
                 </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <Link 
          href="/"
          className="inline-block px-8 py-3 bg-[var(--primary)] text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
        >
          PLAY THIS PACK
        </Link>
      </div>
    </div>
  );
}
