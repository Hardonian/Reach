'use client';

export default function Error({ error }: { error: Error }) {
  return <div className="p-6 text-sm text-red-400">Unable to load semantic governance view: {error.message}</div>;
}
