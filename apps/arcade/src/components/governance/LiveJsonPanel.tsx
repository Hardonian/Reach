'use client';

import { useEffect, useState } from 'react';

export function LiveJsonPanel({
  endpoint,
  title,
  headers,
}: {
  endpoint: string;
  title: string;
  headers?: Record<string, string>;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(endpoint, { cache: 'no-store', headers });
        const json = (await res.json()) as unknown;
        if (!cancelled) setPayload(json);
      } catch {
        if (!cancelled) setError('Live endpoint unavailable. Use CLI command below for direct inspection.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [endpoint, headers]);

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold mb-2">{title}</h2>
      {loading ? <p className="text-sm text-gray-400">Loading live data…</p> : null}
      {!loading && error ? <p className="text-sm text-amber-200">{error}</p> : null}
      {!loading && !error ? <pre className="text-xs overflow-auto max-h-72">{JSON.stringify(payload, null, 2)}</pre> : null}
    </section>
  );
}
