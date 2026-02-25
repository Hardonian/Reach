'use client';

import { useState } from 'react';

export function CommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <code className="text-xs md:text-sm text-accent overflow-x-auto">{command}</code>
        <button type="button" onClick={handleCopy} className="rounded border border-border px-2 py-1 text-xs hover:bg-white/5 transition-colors">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
