'use client';

import React from 'react';
import { StatusIndicator } from './StatusIndicator';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type PolicyStatus = 'active' | 'draft' | 'archived';
export type PolicyType = 'data-residency' | 'rate-limit' | 'pii' | 'model-restriction' | string;

interface PolicyRowProps {
  id: string;
  name: string;
  description: string;
  type: PolicyType;
  severity: Severity;
  status: PolicyStatus;
  regions?: string[];
  limit?: number;
  window?: string;
  createdAt?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const severityConfig: Record<Severity, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Critical' },
  high: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'High' },
  medium: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Medium' },
  low: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Low' },
};

function SeverityBadge({ severity }: { severity: Severity }) {
  const config = severityConfig[severity];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

export function PolicyRow({
  id,
  name,
  description,
  type,
  severity,
  status,
  regions,
  limit,
  window,
  createdAt,
  onEdit,
  onDelete,
}: PolicyRowProps) {
  const statusVariant = status === 'active' ? 'online' : status === 'draft' ? 'pending' : 'offline';

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-bold text-base">{name}</h3>
            <SeverityBadge severity={severity} />
            <StatusIndicator status={statusVariant} showLabel size="sm" />
          </div>
          <p className="text-gray-400 text-sm mb-3">{description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-surface-hover text-gray-500">
              Type: {type}
            </span>
            {regions && regions.length > 0 && (
              <span className="px-2 py-1 rounded bg-surface-hover text-gray-500">
                Regions: {regions.join(', ')}
              </span>
            )}
            {limit && (
              <span className="px-2 py-1 rounded bg-surface-hover text-gray-500">
                Limit: {limit}/{window || '1m'}
              </span>
            )}
            {createdAt && (
              <span className="px-2 py-1 rounded bg-surface-hover text-gray-500">
                Created: {new Date(createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {onEdit && (
            <button
              onClick={() => onEdit(id)}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
