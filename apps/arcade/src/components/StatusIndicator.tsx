"use client";

import React from "react";

export type StatusVariant =
  | "online"
  | "warning"
  | "error"
  | "offline"
  | "pending"
  | "running"
  | "idle";

interface StatusIndicatorProps {
  status: StatusVariant;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const statusConfig: Record<
  StatusVariant,
  { bg: string; text: string; label: string; dot: string }
> = {
  online: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    label: "Online",
    dot: "bg-emerald-500",
  },
  running: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    label: "Running",
    dot: "bg-emerald-500",
  },
  warning: {
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    label: "Warning",
    dot: "bg-amber-500",
  },
  error: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    label: "Error",
    dot: "bg-red-500",
  },
  offline: {
    bg: "bg-gray-500/20",
    text: "text-gray-400",
    label: "Offline",
    dot: "bg-gray-500",
  },
  pending: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    label: "Pending",
    dot: "bg-blue-500",
  },
  idle: {
    bg: "bg-gray-500/20",
    text: "text-gray-400",
    label: "Idle",
    dot: "bg-gray-500",
  },
};

const sizeConfig = {
  sm: { dot: "w-2 h-2", pill: "px-2 py-0.5 text-xs" },
  md: { dot: "w-2.5 h-2.5", pill: "px-2.5 py-1 text-sm" },
  lg: { dot: "w-3 h-3", pill: "px-3 py-1.5 text-sm" },
};

export function StatusIndicator({
  status,
  size = "md",
  pulse = false,
  showLabel = false,
  label,
  className = "",
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const displayLabel = label || config.label;

  if (showLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bg} ${config.text} ${sizes.pill} ${className}`}
      >
        <span
          className={`${sizes.dot} rounded-full ${config.dot} ${pulse ? "animate-pulse" : ""}`}
        />
        {displayLabel}
      </span>
    );
  }

  return (
    <span
      className={`inline-block rounded-full ${sizes.dot} ${config.dot} ${pulse ? "animate-pulse" : ""} ${className}`}
      title={displayLabel}
    />
  );
}

// Pill variant for badges
export function StatusBadge({
  status,
  children,
  className = "",
}: {
  status: StatusVariant;
  children?: React.ReactNode;
  className?: string;
}) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}
    >
      {children || config.label}
    </span>
  );
}
