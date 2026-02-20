/**
 * Canonical graph model for Reach Visual Workflow Builder.
 * Typed JSON representation shared between UI and API.
 */

export type NodeType =
  | 'trigger' | 'agent' | 'rag_query' | 'tool_call'
  | 'validation' | 'branch' | 'planner' | 'output';

// Extends Record<string, unknown> to satisfy @xyflow/react node data constraint
export interface NodeData extends Record<string, unknown> {
  id: string;
  type: NodeType;
  name: string;
  inputs: Record<string, unknown>;
  config: Record<string, unknown>;
  outputs: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface EdgeData {
  id?: string;
  from: string;
  to: string;
  mapping?: Record<string, string>;
}

export interface TriggerData {
  type: 'manual' | 'webhook' | 'schedule';
  config?: Record<string, unknown>;
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
  triggers: TriggerData[];
  policies: string[];
  version: number;
}

/** Validate graph for common issues. Returns array of error strings. */
export function validateGraph(graph: GraphData): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  // Check for duplicate node IDs
  const seen = new Set<string>();
  for (const n of graph.nodes) {
    if (seen.has(n.id)) errors.push(`Duplicate node ID: ${n.id}`);
    seen.add(n.id);
  }

  // Check edges reference valid nodes
  for (const e of graph.edges) {
    if (!nodeIds.has(e.from)) errors.push(`Edge references unknown node: ${e.from}`);
    if (!nodeIds.has(e.to)) errors.push(`Edge references unknown node: ${e.to}`);
    if (e.from === e.to) errors.push(`Self-loop on node: ${e.from}`);
  }

  // Check for cycles using DFS
  if (hasCycle(graph.nodes.map((n) => n.id), graph.edges)) {
    errors.push('Graph contains a cycle. Reach DAGs must be acyclic.');
  }

  // Check reachability: every non-trigger node should be reachable from a trigger
  const triggers = graph.nodes.filter((n) => n.type === 'trigger').map((n) => n.id);
  if (triggers.length === 0 && graph.nodes.length > 0) {
    errors.push('No trigger node found. Add a Trigger node to start the workflow.');
  } else if (triggers.length > 0 && graph.nodes.length > 1) {
    const reachable = reachableNodes(triggers, graph.edges);
    const unreachable = graph.nodes.filter((n) => !triggers.includes(n.id) && !reachable.has(n.id));
    for (const n of unreachable) {
      errors.push(`Node "${n.name}" is unreachable from any trigger.`);
    }
  }

  return errors;
}

function hasCycle(nodeIds: string[], edges: EdgeData[]): boolean {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodeIds) color.set(id, WHITE);

  function dfs(v: string): boolean {
    color.set(v, GRAY);
    for (const u of adj.get(v) ?? []) {
      if (color.get(u) === GRAY) return true;
      if (color.get(u) === WHITE && dfs(u)) return true;
    }
    color.set(v, BLACK);
    return false;
  }

  for (const id of nodeIds) {
    if (color.get(id) === WHITE && dfs(id)) return true;
  }
  return false;
}

function reachableNodes(starts: string[], edges: EdgeData[]): Set<string> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const visited = new Set<string>();
  const queue = [...starts];
  while (queue.length) {
    const v = queue.shift()!;
    if (visited.has(v)) continue;
    visited.add(v);
    for (const u of adj.get(v) ?? []) queue.push(u);
  }
  return visited;
}
