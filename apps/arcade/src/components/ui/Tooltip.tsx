"use client";

import { useState } from "react";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

/**
 * Lightweight inline tooltip for first-time term exposure.
 * Shown on hover/focus. No external dependency.
 */
export function Tooltip({ text, children, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`absolute z-50 ${positionClasses[position]} w-56 rounded-lg bg-gray-900 border border-border px-3 py-2 text-xs text-gray-200 shadow-lg pointer-events-none animate-fade-in`}
        >
          {text}
        </span>
      )}
    </span>
  );
}

/** Underline-dotted term with attached tooltip */
export function Term({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Tooltip text={tooltip}>
      <span className="border-b border-dotted border-gray-500 cursor-help hover:border-accent transition-colors">
        {label}
      </span>
    </Tooltip>
  );
}
