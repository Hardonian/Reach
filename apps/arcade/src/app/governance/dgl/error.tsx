'use client';

export default function DglGovernanceError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <div className="section-container py-8">
      <div className="rounded-lg border border-red-500 p-4 bg-surface text-red-300">
        Unable to load divergence governance page. {error.message}
      </div>
    </div>
  );
}
