'use client';

import { useState } from 'react';
import { PipelineStage, StageType, StageStatus } from '@/components/PipelineStage';
import { EmptyState } from '@/components/EmptyState';

// Mock pipeline stages
const mockStages = [
  {
    id: 'stage-1',
    name: 'Input Parser',
    type: 'input' as StageType,
    status: 'running' as StageStatus,
    description: 'Parse incoming customer messages',
    config: { model: 'gpt-4', temperature: 0.3 },
  },
  {
    id: 'stage-2',
    name: 'Intent Classifier',
    type: 'processor' as StageType,
    status: 'running' as StageStatus,
    description: 'Classify customer intent',
    config: { categories: ['support', 'sales', 'billing'] },
  },
  {
    id: 'stage-3',
    name: 'Knowledge Base',
    type: 'retrieval' as StageType,
    status: 'idle' as StageStatus,
    description: 'Query knowledge base for answers',
    config: { topK: 5, threshold: 0.8 },
  },
  {
    id: 'stage-4',
    name: 'Response Generator',
    type: 'processor' as StageType,
    status: 'idle' as StageStatus,
    description: 'Generate customer response',
    config: { maxTokens: 500 },
  },
  {
    id: 'stage-5',
    name: 'Output Formatter',
    type: 'output' as StageType,
    status: 'idle' as StageStatus,
    description: 'Format and send response',
    config: { format: 'json' },
  },
];

const connections = [
  { from: 'stage-1', to: 'stage-2' },
  { from: 'stage-2', to: 'stage-3' },
  { from: 'stage-3', to: 'stage-4' },
  { from: 'stage-4', to: 'stage-5' },
];

const nodeTypes: Record<StageType, { color: string; icon: string }> = {
  input: { color: '#10B981', icon: '📥' },
  processor: { color: '#7C3AED', icon: '⚙️' },
  retrieval: { color: '#3B82F6', icon: '🔍' },
  output: { color: '#F59E0B', icon: '📤' },
};

// Simple Pipeline Visualization (static layout without DnD)
function PipelineView({
  stages,
  selectedStage,
  onSelectStage,
}: {
  stages: typeof mockStages;
  selectedStage: string | null;
  onSelectStage: (id: string) => void;
}) {
  return (
    <div className="relative min-h-[400px] p-8 bg-surface/30 rounded-xl border border-border overflow-x-auto">
      <svg className="absolute inset-0 w-full h-full pointer-events-none min-w-[600px]">
        {connections.map((conn, i) => {
          const fromIndex = stages.findIndex((s) => s.id === conn.from);
          const toIndex = stages.findIndex((s) => s.id === conn.to);
          const y1 = fromIndex * 80 + 40;
          const y2 = toIndex * 80 + 40;

          return (
            <g key={i}>
              <line
                x1="40"
                y1={y1}
                x2="40"
                y2={y2}
                stroke="rgba(124, 58, 237, 0.3)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <circle cx="40" cy={y2} r="3" fill="#7C3AED" />
            </g>
          );
        })}
      </svg>

      <div className="relative space-y-6 min-w-[600px]">
        {stages.map((stage) => (
          <PipelineStage
            key={stage.id}
            {...stage}
            isSelected={selectedStage === stage.id}
            onClick={() => onSelectStage(stage.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default function StudioPage() {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'design' | 'test' | 'deploy'>('design');

  const selectedStageData = mockStages.find((s) => s.id === selectedStage);

  return (
    <div className="section-container py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Agent Lab</h1>
          <p className="text-gray-400">Design and verify agent workflows</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm py-2">Import</button>
          <button className="btn-secondary text-sm py-2">Save Draft</button>
          <button className="btn-primary text-sm py-2">Deploy Pipeline</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-lg mb-8 w-fit">
        {(['design', 'test', 'deploy'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'design' && (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Pipeline Canvas */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Customer Support Flow</h2>
              <button className="text-sm text-accent hover:text-accent/80">+ Add Stage</button>
            </div>
            <PipelineView
              stages={mockStages}
              selectedStage={selectedStage}
              onSelectStage={setSelectedStage}
            />
          </div>

          {/* Properties Panel */}
          <div>
            <h2 className="text-xl font-bold mb-4">Properties</h2>
            {selectedStageData ? (
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-node-${selectedStageData.type}`}
                  >
                    {nodeTypes[selectedStageData.type].icon}
                  </div>
                  <div>
                    <h3 className="font-bold">{selectedStageData.name}</h3>
                    <span className="text-xs text-gray-500 uppercase">{selectedStageData.type}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Description</label>
                    <p className="text-sm">{selectedStageData.description}</p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 block mb-2">Configuration</label>
                    <div className="space-y-2">
                      {Object.entries(selectedStageData.config).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-gray-400">{key}</span>
                          <span className="font-mono">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border flex gap-2">
                    <button className="flex-1 btn-primary text-sm py-2">Update</button>
                    <button className="px-3 py-2 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 text-sm">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon="🎨"
                title="Select a Stage"
                description="Click on a pipeline stage to view and edit its properties."
              />
            )}

            {/* Available Nodes */}
            <div className="mt-6">
              <h3 className="font-bold mb-3">Available Nodes</h3>
              <div className="space-y-2">
                {Object.entries(nodeTypes).map(([type, config]) => (
                  <button
                    key={type}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface hover:bg-surface-hover transition-colors text-left"
                  >
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center bg-node-${type}`}
                    >
                      {config.icon}
                    </div>
                    <span className="capitalize text-sm">{type}</span>
                    <span className="ml-auto text-gray-500">+</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'test' && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Test Pipeline</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 block mb-2">Test Input</label>
              <textarea
                className="w-full h-32 px-4 py-3 rounded-lg bg-surface border border-border text-white placeholder-gray-500 focus:outline-none focus:border-accent font-mono text-sm"
                placeholder='{"message": "Hello, I need help with my account"}'
              />
            </div>
            <button className="btn-primary">Run Test</button>
          </div>
        </div>
      )}

      {activeTab === 'deploy' && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Deploy Pipeline</h2>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 block mb-2">Target Region</label>
                <select title="Select Target Region" className="w-full px-4 py-2 rounded-lg bg-surface border border-border text-white focus:outline-none focus:border-accent">
                  <option>Auto (Global)</option>
                  <option>US East</option>
                  <option>US West</option>
                  <option>Europe</option>
                  <option>Asia Pacific</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-2">Environment</label>
                <select title="Select Environment" className="w-full px-4 py-2 rounded-lg bg-surface border border-border text-white focus:outline-none focus:border-accent">
                  <option>Production</option>
                  <option>Staging</option>
                  <option>Development</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button className="btn-primary">Deploy Now</button>
              <button className="btn-secondary">Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
