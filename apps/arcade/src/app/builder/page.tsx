'use client';

/**
 * Reach Visual Workflow Builder
 * Phase 2: n8n-class DAG builder using @xyflow/react
 *
 * Features:
 * - Draggable node palette (Agent, RAG Query, Tool Call, Validation, Branch, Planner, Output)
 * - Edge connections with input/output mapping
 * - Inspector panel for node config
 * - Graph validation (cycles, reachability)
 * - Save to Cloud / Export JSON / Import JSON
 * - Run workflow inline
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, Background, MiniMap,
  addEdge, useNodesState, useEdgesState, BackgroundVariant,
  type Connection, type Edge, type Node, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowNode } from '@/components/WorkflowBuilder/WorkflowNode';
import { NodePalette } from '@/components/WorkflowBuilder/NodePalette';
import { NodeInspector } from '@/components/WorkflowBuilder/NodeInspector';
import { validateGraph, type GraphData, type NodeData } from '@/lib/workflow-graph';

const nodeTypes: NodeTypes = { workflowNode: WorkflowNode };

function WorkflowBuilderInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<{ status: string; runId: string } | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('reach_tenant_id') ?? '' : '';
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}) };

  // Load workflow from URL param
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const wid = searchParams.get('workflow');
    if (wid) {
      setWorkflowId(wid);
      fetch(`/api/v1/workflows/${wid}`, { headers }).then((r) => r.ok ? r.json() : null).then((d) => {
        if (!d?.workflow) return;
        setWorkflowName(d.workflow.name);
        const g = d.workflow.graph as GraphData;
        if (g.nodes?.length) {
          setNodes(g.nodes.map((n, i) => ({
            id: n.id, type: 'workflowNode',
            position: (n as { position?: { x: number; y: number } }).position ?? { x: i * 220, y: 100 },
            data: n,
          })));
          setEdges(g.edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to })));
        }
      });
    }
  }, []);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#10b981' } }, eds));
  }, [setEdges]);

  function addNode(type: NodeData['type']) {
    const id = `node_${++idCounter.current}`;
    const NODE_LABELS: Record<string, string> = {
      trigger: 'Trigger', agent: 'Agent', rag_query: 'RAG Query',
      tool_call: 'Tool Call', validation: 'Validation', branch: 'Branch',
      planner: 'Planner', output: 'Output',
    };
    const newNode: Node<NodeData> = {
      id, type: 'workflowNode',
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 200 },
      data: { id, type, name: NODE_LABELS[type] ?? type, inputs: {}, config: {}, outputs: {} },
    };
    setNodes((nds) => [...nds, newNode]);
  }

  function updateNodeData(nodeId: string, patch: Partial<NodeData>) {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
    ));
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...patch } } : prev);
  }

  function buildGraphData(): GraphData {
    return {
      nodes: nodes.map((n) => ({
        ...n.data,
        position: n.position,
      })),
      edges: edges.map((e) => ({ id: e.id, from: e.source, to: e.target })),
      triggers: [{ type: 'manual' }],
      policies: [],
      version: 1,
    };
  }

  function validate(): boolean {
    const graph = buildGraphData();
    const errs = validateGraph(graph);
    setValidationErrors(errs);
    return errs.length === 0;
  }

  async function saveWorkflow() {
    if (!validate()) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const graph = buildGraphData();
      const body = { name: workflowName, description: '', graph };

      let res: Response;
      if (workflowId) {
        res = await fetch(`/api/v1/workflows/${workflowId}`, {
          method: 'PATCH', headers, body: JSON.stringify({ name: workflowName, graph }),
        });
      } else {
        res = await fetch('/api/v1/workflows', { method: 'POST', headers, body: JSON.stringify(body) });
      }

      const data = await res.json() as { workflow?: { id: string }; error?: string };
      if (!res.ok) { setSaveMsg(`Error: ${data.error}`); return; }
      if (data.workflow?.id && !workflowId) {
        setWorkflowId(data.workflow.id);
        window.history.replaceState({}, '', `?workflow=${data.workflow.id}`);
      }
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function runWorkflow() {
    if (!workflowId) { await saveWorkflow(); }
    if (!workflowId) { setSaveMsg('Save first to run'); return; }
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`/api/v1/workflows/${workflowId}/runs`, {
        method: 'POST', headers, body: JSON.stringify({ inputs: {} }),
      });
      const data = await res.json() as { run?: { id: string; status: string }; error?: string };
      if (res.ok && data.run) {
        setRunResult({ status: data.run.status, runId: data.run.id });
      } else {
        setSaveMsg(`Run error: ${data.error}`);
      }
    } finally {
      setRunning(false);
    }
  }

  function exportJSON() {
    const graph = buildGraphData();
    const blob = new Blob([JSON.stringify({ name: workflowName, graph }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function importJSON() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as { name?: string; graph?: GraphData };
          if (data.name) setWorkflowName(data.name);
          if (data.graph?.nodes) {
            setNodes(data.graph.nodes.map((n, i) => ({
              id: n.id, type: 'workflowNode' as const,
              position: (n as { position?: { x: number; y: number } }).position ?? { x: i * 220, y: 100 },
              data: n,
            })));
            setEdges((data.graph.edges ?? []).map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to })));
            setValidationErrors([]);
          }
        } catch { alert('Invalid JSON file'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface shrink-0">
        <input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="text-white bg-transparent border-none outline-none font-semibold text-sm min-w-48"
        />
        <div className="flex-1" />
        {saveMsg && <span className={`text-xs ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{saveMsg}</span>}
        {validationErrors.length > 0 && (
          <span className="text-xs text-yellow-400">{validationErrors.length} issue(s)</span>
        )}
        <button onClick={importJSON} className="text-xs text-gray-400 hover:text-white px-2 py-1 border border-border rounded">Import</button>
        <button onClick={exportJSON} className="text-xs text-gray-400 hover:text-white px-2 py-1 border border-border rounded">Export</button>
        <button onClick={validate} className="text-xs text-gray-400 hover:text-white px-2 py-1 border border-border rounded">Validate</button>
        <button onClick={saveWorkflow} disabled={saving}
          className="text-xs px-3 py-1 border border-border text-white rounded hover:border-accent disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={runWorkflow} disabled={running}
          className="text-xs px-3 py-1 bg-accent text-black font-semibold rounded hover:bg-accent/90 disabled:opacity-50">
          {running ? 'Running…' : '▶ Run'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Node Palette */}
        <NodePalette onAdd={addNode} />

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          {runResult && (
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg text-sm border
              ${runResult.status === 'completed' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
              Run {runResult.status} · ID: {runResult.runId.slice(0, 20)}…
            </div>
          )}
          {validationErrors.length > 0 && (
            <div className="absolute top-4 right-4 z-10 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 max-w-64">
              {validationErrors.map((e, i) => (
                <p key={i} className="text-xs text-yellow-300">{e}</p>
              ))}
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNode(node as Node<NodeData>)}
            onPaneClick={() => setSelectedNode(null)}
            fitView
            className="bg-[#0a0a0a]"
          >
            <Background variant={BackgroundVariant.Dots} color="#1a1a1a" gap={20} />
            <Controls className="[&>button]:bg-surface [&>button]:border-border [&>button]:text-white" />
            <MiniMap
              className="bg-surface border-border rounded"
              nodeColor={(n) => {
                const colors: Record<string, string> = {
                  trigger: '#10b981', agent: '#7c3aed', rag_query: '#2563eb',
                  tool_call: '#d97706', validation: '#dc2626', branch: '#db2777',
                  planner: '#0891b2', output: '#65a30d',
                };
                return colors[(n.data as NodeData)?.type ?? ''] ?? '#6b7280';
              }}
            />
          </ReactFlow>
        </div>

        {/* Inspector Panel */}
        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            onUpdate={(patch) => updateNodeData(selectedNode.id, patch)}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function WorkflowBuilderPage() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}
