"use client";

import { useState } from "react";

interface CopyCommandButtonProps {
  command: string;
  label?: string;
  className?: string;
}

export function CopyCommandButton({
  command,
  label = "Copy CLI",
  className = "",
}: CopyCommandButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className={`inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white ${className}`}
      title={command}
    >
      <span className="material-symbols-outlined text-[16px]">content_copy</span>
      {copied ? "Copied" : label}
    </button>
  );
}
