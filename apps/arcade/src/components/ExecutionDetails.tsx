'use client';

import { useState } from 'react';
import type { ExecutionGraph, RunArtifact } from '@/lib/runtime';

const NODE_COLORS: Record<string, string> = {
  input: '#10B981',
  skill: '#7C3AED',
  tool: '#3B82F6',
  provider: '#F59E0B',
  evaluation: '#EC4899',
  output: '#6B7280',
};

const NODE_ICONS: Record<string, string> = {
  input: '📥',
  skill: '🧩',
  tool: '🔧',
  provider: '☁',
  evaluation: '📊',
  output: '📤',
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'text-emerald-400 bg-emerald-950/40',
  running: 'text-yellow-400 bg-yellow-950/40',
  failed: 'text-red-400 bg-red-950/40',
  pending: 'text-gray-400 bg-gray-950/40',
  skipped: 'text-gray-600 bg-gray-950/20',
};

type Tab = 'graph' | 'tools' | 'tokens' | 'artifacts';

export function ExecutionDetails({
  graph,
  artifacts,
}: {
  graph: ExecutionGraph;
  artifacts: RunArtifact[];
}) {
  const [tab, setTab] = useState<Tab>('graph');
  const [expandedArtifact, setExpandedArtifact] = useState<string | null>(null);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'graph', label: 'Execution Graph' },
    { id: 'tools', label: 'Tool Log' },
    { id: 'tokens', label: 'Tokens & Cost' },
    { id: 'artifacts', label: 'Artifacts' },
  ];

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold">Execution Details</h3>
          <span className="text-xs text-gray-500 font-mono">{graph.runId}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className={`status-pill ${graph.status === 'completed' ? 'online' : 'error'}`}>
            {graph.status}
          </span>
          <span>{graph.totalDurationMs}ms</span>
          <span>·</span>
          <span>{graph.mode}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-lg mb-4 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Graph Tab */}
      {tab === 'graph' && (
        <div className="card">
          <div className="space-y-2">
            {graph.nodes.map((node) => {
              const color = NODE_COLORS[node.type] ?? '#6B7280';
              return (
                <div key={node.id} className="flex items-center gap-3 p-2 rounded-lg bg-black/20 border border-white/5">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    {NODE_ICONS[node.type] ?? '•'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{node.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLES[node.status]}`}>
                        {node.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-600">{node.type}</span>
                  </div>
                  {node.durationMs !== undefined && node.durationMs > 0 && (
                    <span className="text-xs text-gray-500 font-mono flex-shrink-0">{node.durationMs}ms</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Edges summary */}
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Flow</h4>
            <div className="flex flex-wrap gap-1">
              {graph.edges.map((edge, i) => (
                <span key={i} className="text-xs text-gray-500">
                  {graph.nodes.find((n) => n.id === edge.from)?.label ?? edge.from}
                  {' → '}
                  {graph.nodes.find((n) => n.id === edge.to)?.label ?? edge.to}
                  {i < graph.edges.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tools Tab */}
      {tab === 'tools' && (
        <div className="card">
          {graph.toolInvocations.length === 0 ? (
            <p className="text-sm text-gray-500">No tool invocations in this run.</p>
          ) : (
            <div className="space-y-3">
              {graph.toolInvocations.map((inv, i) => (
                <div key={i} className="p-3 rounded-lg bg-black/20 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{inv.toolName}</span>
                      <span className="text-xs text-gray-600">{inv.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        inv.status === 'success'
                          ? 'text-emerald-400 bg-emerald-950/40'
                          : 'text-red-400 bg-red-950/40'
                      }`}>
                        {inv.status}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">{inv.durationMs}ms</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {inv.startedAt}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tokens Tab */}
      {tab === 'tokens' && (
        <div className="card">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="text-xs text-gray-500 mb-1">Input Tokens</div>
              <div className="text-lg font-bold">{graph.tokenUsage.inputTokens.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="text-xs text-gray-500 mb-1">Output Tokens</div>
              <div className="text-lg font-bold">{graph.tokenUsage.outputTokens.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="text-xs text-gray-500 mb-1">Total Tokens</div>
              <div className="text-lg font-bold">{graph.tokenUsage.totalTokens.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="text-xs text-gray-500 mb-1">Est. Cost</div>
              <div className="text-lg font-bold">${graph.tokenUsage.estimatedCost}</div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Provider</h4>
            <div className="text-sm">
              <span className="text-gray-300">{graph.provider.providerName}</span>
              <span className="text-gray-600"> / </span>
              <span className="text-gray-400">{graph.provider.modelName}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Strategy: {graph.provider.reason} · Attempt #{graph.provider.attemptNumber}
            </div>
          </div>
        </div>
      )}

      {/* Artifacts Tab */}
      {tab === 'artifacts' && (
        <div className="space-y-3">
          {artifacts.map((artifact) => {
            const isExpanded = expandedArtifact === artifact.format;
            return (
              <div key={artifact.format} className="card">
                <button
                  onClick={() => setExpandedArtifact(isExpanded ? null : artifact.format)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <h4 className="font-medium text-sm">{formatLabel(artifact.format)}</h4>
                    <span className="text-xs text-gray-500">{artifact.generatedAt}</span>
                  </div>
                  <span className="text-gray-500 text-sm">{isExpanded ? '−' : '+'}</span>
                </button>
                {isExpanded && (
                  <div className="mt-3 p-3 rounded bg-black/30 border border-white/5 overflow-x-auto max-h-64 overflow-y-auto">
                    <pre className="text-xs text-gray-400 font-mono whitespace-pre">
                      {artifact.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatLabel(format: string): string {
  switch (format) {
    case 'json': return 'JSON Export';
    case 'mcp-config': return 'MCP Server Config';
    case 'cli-command': return 'CLI Rerun Command';
    case 'report': return 'Shareable Report';
    default: return format;
  }
}
