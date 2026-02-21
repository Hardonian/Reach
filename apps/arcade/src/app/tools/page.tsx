'use client';

import { useState } from 'react';
import { getAllTools, TOOL_TYPE_META } from '@/lib/runtime';
import type { ToolDefinition, ToolType } from '@/lib/runtime';

const ALL_TYPES: ToolType[] = ['http', 'github', 'file', 'webhook', 'local-cli', 'vector-db'];

export default function ToolsPage() {
  const tools = getAllTools();
  const [filterType, setFilterType] = useState<ToolType | 'all'>('all');
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);

  const filtered = filterType === 'all' ? tools : tools.filter((t) => t.type === filterType);

  return (
    <div className="section-container py-12">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-bold mb-3">Tools</h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Executable capabilities with permissions, scope, and audit trails. Bind tools to skills.
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Type Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'all' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white bg-surface border border-border'
            }`}
          >
            All ({tools.length})
          </button>
          {ALL_TYPES.map((type) => {
            const meta = TOOL_TYPE_META[type];
            const count = tools.filter((t) => t.type === type).length;
            if (count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterType === type ? 'bg-accent text-white' : 'text-gray-400 hover:text-white bg-surface border border-border'
                }`}
              >
                {meta.icon} {meta.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Tool Grid */}
          <div className="lg:col-span-2">
            <div className="grid md:grid-cols-2 gap-4">
              {filtered.map((tool) => {
                const meta = TOOL_TYPE_META[tool.type];
                const isSelected = selectedTool?.id === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedTool(tool)}
                    className={`text-left card transition-all ${
                      isSelected ? 'border-accent bg-accent/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                        style={{ backgroundColor: `${meta.color}20` }}
                      >
                        {meta.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{tool.name}</h3>
                        <span className="text-xs text-gray-500">{meta.label}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{tool.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{tool.permissions.length} permission{tool.permissions.length !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{tool.boundSkills.length} skill{tool.boundSkills.length !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail Panel */}
          <div>
            {selectedTool ? (
              <div className="card sticky top-24">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ backgroundColor: `${TOOL_TYPE_META[selectedTool.type].color}20` }}
                  >
                    {TOOL_TYPE_META[selectedTool.type].icon}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">{selectedTool.name}</h2>
                    <span className="text-xs text-gray-500">{TOOL_TYPE_META[selectedTool.type].label}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-400 mb-4">{selectedTool.description}</p>

                {/* Permissions */}
                <div className="mb-4">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Permissions</h3>
                  <div className="space-y-1">
                    {selectedTool.permissions.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={p.granted ? 'text-emerald-400' : 'text-red-400'}>
                          {p.granted ? '✓' : '✕'}
                        </span>
                        <span className="text-gray-400">{p.action}</span>
                        <span className="text-gray-600">on</span>
                        <code className="font-mono text-gray-300">{p.resource}</code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scope */}
                <div className="mb-4">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Scope</h3>
                  <span className={`status-pill ${selectedTool.scope.global ? 'online' : 'pending'}`}>
                    {selectedTool.scope.global ? 'Global' : 'Scoped'}
                  </span>
                </div>

                {/* Bound Skills */}
                {selectedTool.boundSkills.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Bound Skills</h3>
                    <div className="flex flex-wrap gap-1">
                      {selectedTool.boundSkills.map((s) => (
                        <span key={s} className="text-xs px-2 py-1 rounded bg-accent/10 text-accent font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Config */}
                {Object.keys(selectedTool.config).length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Config</h3>
                    <div className="p-2 rounded bg-black/20 border border-white/5 overflow-x-auto">
                      <pre className="text-xs text-gray-400 font-mono whitespace-pre">
                        {JSON.stringify(selectedTool.config, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card text-center py-12">
                <div className="text-4xl mb-3">🔧</div>
                <h3 className="font-bold mb-1">Select a Tool</h3>
                <p className="text-sm text-gray-500">Click a tool to view permissions, scope, and bindings.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
