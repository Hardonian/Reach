'use client';

import { useState } from 'react';
import type { Node } from '@xyflow/react';
import type { NodeData } from '@/lib/workflow-graph';

interface Props {
  node: Node<NodeData>;
  onUpdate: (patch: Partial<NodeData>) => void;
  onClose: () => void;
}

const NODE_CONFIG_FIELDS: Record<string, { key: string; label: string; type: string; placeholder?: string }[]> = {
  agent: [
    { key: 'model', label: 'Model', type: 'text', placeholder: 'kimi-coding-2.5' },
    { key: 'temperature', label: 'Temperature', type: 'number', placeholder: '0.7' },
    { key: 'max_tokens', label: 'Max Tokens', type: 'number', placeholder: '4096' },
    { key: 'system_prompt', label: 'System Prompt', type: 'textarea' },
  ],
  rag_query: [
    { key: 'collection', label: 'Collection', type: 'text', placeholder: 'default' },
    { key: 'top_k', label: 'Top K', type: 'number', placeholder: '5' },
    { key: 'threshold', label: 'Threshold', type: 'number', placeholder: '0.8' },
  ],
  tool_call: [
    { key: 'tool', label: 'Tool Name', type: 'text', placeholder: 'http.get' },
    { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '5000' },
  ],
  validation: [
    { key: 'schema', label: 'Schema (JSON)', type: 'textarea', placeholder: '{"type":"object"}' },
    { key: 'strict', label: 'Strict Mode', type: 'text', placeholder: 'true' },
  ],
  branch: [
    { key: 'condition', label: 'Condition', type: 'text', placeholder: '$.output.score > 0.5' },
  ],
  planner: [
    { key: 'max_steps', label: 'Max Steps', type: 'number', placeholder: '10' },
    { key: 'strategy', label: 'Strategy', type: 'text', placeholder: 'chain-of-thought' },
  ],
  trigger: [
    { key: 'type', label: 'Type', type: 'text', placeholder: 'manual' },
  ],
  output: [
    { key: 'format', label: 'Format', type: 'text', placeholder: 'json' },
  ],
};

export function NodeInspector({ node, onUpdate, onClose }: Props) {
  const [configJson, setConfigJson] = useState(() => JSON.stringify(node.data.config, null, 2));
  const [configError, setConfigError] = useState('');

  const fields = NODE_CONFIG_FIELDS[node.data.type] ?? [];

  function handleFieldChange(key: string, value: string) {
    const newConfig = { ...node.data.config, [key]: value };
    onUpdate({ config: newConfig });
    setConfigJson(JSON.stringify(newConfig, null, 2));
  }

  function handleJsonChange(json: string) {
    setConfigJson(json);
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      setConfigError('');
      onUpdate({ config: parsed });
    } catch {
      setConfigError('Invalid JSON');
    }
  }

  return (
    <div className="w-72 shrink-0 border-l border-border bg-[#0d0d0d] overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-white">Node Inspector</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
      </div>

      <div className="p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            value={node.data.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm text-white"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <p className="text-sm text-accent">{node.data.type}</p>
        </div>

        {/* Quick fields */}
        {fields.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Configuration</p>
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea
                    value={String(node.data.config[f.key] ?? '')}
                    onChange={(e) => handleFieldChange(f.key, e.target.value)}
                    rows={3}
                    placeholder={f.placeholder}
                    className="w-full px-2 py-1.5 bg-background border border-border rounded text-xs text-white font-mono resize-y"
                  />
                ) : (
                  <input
                    type={f.type}
                    value={String(node.data.config[f.key] ?? '')}
                    onChange={(e) => handleFieldChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm text-white"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Raw JSON editor */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Raw Config (JSON)</label>
          <textarea
            value={configJson}
            onChange={(e) => handleJsonChange(e.target.value)}
            rows={6}
            className={`w-full px-2 py-1.5 bg-background border rounded text-xs text-green-300 font-mono resize-y ${configError ? 'border-red-500' : 'border-border'}`}
          />
          {configError && <p className="text-xs text-red-400 mt-1">{configError}</p>}
        </div>

        {/* Node ID (readonly) */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">ID</label>
          <p className="text-xs font-mono text-gray-600">{node.id}</p>
        </div>
      </div>
    </div>
  );
}
