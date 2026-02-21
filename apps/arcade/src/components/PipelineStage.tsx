'use client';

import React from 'react';
import { StatusIndicator } from './StatusIndicator';

export type StageType = 'input' | 'processor' | 'retrieval' | 'output';
export type StageStatus = 'running' | 'idle' | 'error';

interface PipelineStageProps {
  id: string;
  name: string;
  description: string;
  type: StageType;
  status: StageStatus;
  isSelected?: boolean;
  onClick?: () => void;
}

const typeConfig: Record<StageType, { color: string; icon: string; label: string }> = {
  input: { color: '#10B981', icon: '📥', label: 'Input' },
  processor: { color: '#7C3AED', icon: '⚙️', label: 'Processor' },
  retrieval: { color: '#3B82F6', icon: '🔍', label: 'Retrieval' },
  output: { color: '#F59E0B', icon: '📤', label: 'Output' },
};

export function PipelineStage({
  id,
  name,
  description,
  type,
  status,
  isSelected = false,
  onClick,
}: PipelineStageProps) {
  const typeInfo = typeConfig[type];
  const statusVariant = status === 'running' ? 'running' : status === 'error' ? 'error' : 'idle';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
        isSelected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface hover:border-accent/50'
      }`}
    >
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0"
        style={{ backgroundColor: `${typeInfo.color}20` }}
      >
        {typeInfo.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-bold truncate">{name}</h4>
          <StatusIndicator status={statusVariant} pulse={status === 'running'} />
        </div>
        <p className="text-sm text-gray-500 truncate">{description}</p>
      </div>
      <div className="text-xs text-gray-500 uppercase tracking-wider shrink-0 hidden sm:block">
        {typeInfo.label}
      </div>
    </div>
  );
}

// Compact version for inline lists
export function PipelineStageCompact({
  name,
  type,
  status,
}: {
  name: string;
  type: StageType;
  status: StageStatus;
}) {
  const typeInfo = typeConfig[type];
  const statusVariant = status === 'running' ? 'running' : status === 'error' ? 'error' : 'idle';

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface/50">
      <div
        className="w-8 h-8 rounded flex items-center justify-center text-lg shrink-0"
        style={{ backgroundColor: `${typeInfo.color}20` }}
      >
        {typeInfo.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{name}</span>
          <StatusIndicator status={statusVariant} size="sm" pulse={status === 'running'} />
        </div>
      </div>
    </div>
  );
}
