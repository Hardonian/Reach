'use client';

import type { NodeData } from '@/lib/workflow-graph';

const PALETTE_NODES: { type: NodeData['type']; label: string; icon: string; description: string; color: string }[] = [
  { type: 'trigger',    label: 'Trigger',    icon: '▶',  description: 'Starts the workflow', color: '#10b981' },
  { type: 'agent',      label: 'Agent',      icon: '🤖', description: 'AI agent execution',  color: '#7c3aed' },
  { type: 'rag_query',  label: 'RAG Query',  icon: '🔍', description: 'Retrieve context',    color: '#2563eb' },
  { type: 'tool_call',  label: 'Tool Call',  icon: '🔧', description: 'Invoke external tool', color: '#d97706' },
  { type: 'validation', label: 'Validation', icon: '✓',  description: 'Validate outputs',    color: '#dc2626' },
  { type: 'branch',     label: 'Branch',     icon: '⑂',  description: 'Conditional routing', color: '#db2777' },
  { type: 'planner',    label: 'Planner',    icon: '📋', description: 'Plan task sequence',  color: '#0891b2' },
  { type: 'output',     label: 'Output',     icon: '📤', description: 'Collect results',     color: '#65a30d' },
];

interface Props {
  onAdd: (type: NodeData['type']) => void;
}

export function NodePalette({ onAdd }: Props) {
  return (
    <div className="w-48 shrink-0 border-r border-border bg-[#0d0d0d] overflow-y-auto">
      <div className="p-3 border-b border-border">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Node Types</p>
        <p className="text-xs text-gray-600 mt-0.5">Click to add</p>
      </div>
      <div className="p-2 space-y-1">
        {PALETTE_NODES.map((node) => (
          <button
            key={node.type}
            onClick={() => onAdd(node.type)}
            className="w-full text-left p-2.5 rounded-lg border border-transparent hover:border-[#2a2a2a] hover:bg-[#141414] transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-7 h-7 flex items-center justify-center rounded-lg text-sm shrink-0"
                style={{ backgroundColor: `${node.color}20`, color: node.color }}
              >
                {node.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white">{node.label}</p>
                <p className="text-xs text-gray-500 truncate">{node.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="p-3 border-t border-border mt-2">
        <p className="text-xs text-gray-600">
          Drag edges between handles to connect nodes.
        </p>
      </div>
    </div>
  );
}
