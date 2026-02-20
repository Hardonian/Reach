'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeData } from '@/lib/workflow-graph';

const NODE_STYLES: Record<string, { color: string; bg: string; icon: string }> = {
  trigger:    { color: '#10b981', bg: '#10b98115', icon: '▶' },
  agent:      { color: '#7c3aed', bg: '#7c3aed15', icon: '🤖' },
  rag_query:  { color: '#2563eb', bg: '#2563eb15', icon: '🔍' },
  tool_call:  { color: '#d97706', bg: '#d9770615', icon: '🔧' },
  validation: { color: '#dc2626', bg: '#dc262615', icon: '✓' },
  branch:     { color: '#db2777', bg: '#db277715', icon: '⑂' },
  planner:    { color: '#0891b2', bg: '#0891b215', icon: '📋' },
  output:     { color: '#65a30d', bg: '#65a30d15', icon: '📤' },
};

export const WorkflowNode = memo(function WorkflowNode({ data, selected }: NodeProps) {
  const nodeData = data as NodeData;
  const style = NODE_STYLES[nodeData.type] ?? NODE_STYLES['agent'];

  return (
    <div
      style={{
        borderColor: selected ? style.color : '#2a2a2a',
        backgroundColor: style.bg,
        borderWidth: 1.5,
        borderStyle: 'solid',
      }}
      className="rounded-xl min-w-40 shadow-lg"
    >
      {/* Input handle (except for trigger) */}
      {nodeData.type !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: style.color, width: 10, height: 10, border: '2px solid #0a0a0a' }}
        />
      )}

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">{style.icon}</span>
          <div>
            <p className="text-xs font-semibold text-white leading-tight">{nodeData.name}</p>
            <p className="text-xs" style={{ color: style.color }}>{nodeData.type.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Config preview */}
        {Object.keys(nodeData.config).length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/5">
            {Object.entries(nodeData.config).slice(0, 2).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500 truncate">{k}:</span>
                <span className="text-xs text-gray-300 truncate max-w-24">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output handle (except for output) */}
      {nodeData.type !== 'output' && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: style.color, width: 10, height: 10, border: '2px solid #0a0a0a' }}
        />
      )}

      {/* Branch has two output handles */}
      {nodeData.type === 'branch' && (
        <Handle
          id="false"
          type="source"
          position={Position.Bottom}
          style={{ background: '#db2777', width: 10, height: 10, border: '2px solid #0a0a0a' }}
        />
      )}
    </div>
  );
});
