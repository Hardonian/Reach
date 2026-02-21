import React from 'react';

export function ArchitectureVisualization() {
  return (
    <main className="flex-grow pt-24 pb-12 relative overflow-hidden min-h-screen bg-[#f6f6f8] dark:bg-[#101622]">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.07] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-linear-to-b from-[#101622] via-transparent to-[#101622] pointer-events-none z-0"></div>
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 flex flex-col gap-12">
        {/* Header Text */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            The Reach <span className="text-[#135bec]">Architecture</span>
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 font-light">
            Transparency in Agentic Orchestration. Explore the primitives that power our safe, scalable control plane.
          </p>
        </div>

        {/* Visualization Canvas */}
        <div className="w-full relative min-h-[600px] bg-white/50 dark:bg-[#1c212c]/50 border border-slate-200 dark:border-[#2d3545] rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm group/canvas">
          {/* Toolbar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-white dark:bg-[#1c212c] border border-slate-200 dark:border-[#2d3545] rounded-lg shadow-lg z-20">
            <button type="button" className="p-2 hover:bg-slate-100 dark:hover:bg-[#2d3545] rounded text-slate-400 hover:text-white" title="Reset View">
              <span className="material-symbols-outlined text-[20px]">center_focus_strong</span>
            </button>
            <div className="w-px h-4 bg-slate-200 dark:border-[#2d3545] mx-1"></div>
            <button type="button" className="p-2 hover:bg-slate-100 dark:hover:bg-[#2d3545] rounded text-[#135bec] bg-[#135bec]/10" title="Show Traceability Spine">
              <span className="material-symbols-outlined text-[20px]">timeline</span>
            </button>
            <button type="button" className="p-2 hover:bg-slate-100 dark:hover:bg-[#2d3545] rounded text-slate-400 hover:text-white" title="Show Security Layers">
              <span className="material-symbols-outlined text-[20px]">security</span>
            </button>
            <div className="w-px h-4 bg-slate-200 dark:border-[#2d3545] mx-1"></div>
            <span className="text-xs text-slate-500 font-mono px-2">v2.4.0-stable</span>
          </div>

          {/* Legend */}
          <div className="absolute top-6 left-6 flex flex-col gap-2 p-4 bg-white/90 dark:bg-[#1c212c]/90 border border-slate-200 dark:border-[#2d3545] rounded-lg backdrop-blur z-20">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Legend</p>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="size-2 rounded-full bg-[#135bec]"></div>
              <span>Active Execution</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="size-2 rounded-full bg-emerald-500"></div>
              <span>Passed Safe Ops</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="size-2 rounded-full bg-slate-500"></div>
              <span>Idle / Storage</span>
            </div>
          </div>

          {/* Diagram Container */}
          <div className="absolute inset-0 flex items-center justify-center p-10 overflow-x-auto scrollbar-hide">
            <div className="relative min-w-[800px] w-full flex items-center justify-between gap-8">
              {/* Traceability Spine */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:border-[#2d3545] -translate-y-1/2 z-0"></div>
              <div className="absolute top-1/2 left-[10%] right-[10%] h-0.5 node-connector -translate-y-1/2 z-0 opacity-40"></div>
              
              {/* Node 1: Agents */}
              <div className="relative z-10 flex flex-col items-center gap-4 group/node cursor-pointer">
                <div className="w-40 h-24 bg-white dark:bg-[#1c212c] border-2 border-slate-200 dark:border-[#2d3545] rounded-xl flex flex-col items-center justify-center p-4 transition-all duration-300 glow-hover">
                  <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 group-hover/node:bg-[#135bec]/20 group-hover/node:text-[#135bec] transition-colors text-slate-400">
                    <span className="material-symbols-outlined">smart_toy</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Agents</span>
                </div>
                <div className="absolute top-28 opacity-0 group-hover/node:opacity-100 transition-opacity w-56 p-3 bg-white dark:bg-[#0F1115] border border-slate-200 dark:border-[#2d3545] rounded-lg shadow-xl pointer-events-none">
                  <h4 className="text-slate-900 dark:text-white text-xs font-bold mb-1">Autonomous Unit</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">Capable of complex reasoning and breaking down user intent into actionable tasks.</p>
                </div>
              </div>

              {/* Connector Label */}
              <div className="z-10 bg-white dark:bg-[#101622] px-2 py-1 rounded border border-slate-200 dark:border-[#2d3545] text-[10px] font-mono text-slate-500">JSON-RPC</div>

              {/* Node 2: Runners */}
              <div className="relative z-10 flex flex-col items-center gap-4 group/node cursor-pointer">
                <div className="relative w-40 h-24 bg-white dark:bg-[#1c212c] border-2 border-slate-200 dark:border-[#2d3545] rounded-xl flex flex-col items-center justify-center p-4 transition-all duration-300 glow-hover">
                  <div className="absolute -top-1 -right-1 size-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#101622] animate-pulse"></div>
                  <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 group-hover/node:bg-[#135bec]/20 group-hover/node:text-[#135bec] transition-colors text-slate-400">
                    <span className="material-symbols-outlined">memory</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Runners</span>
                </div>
                <div className="absolute top-28 opacity-0 group-hover/node:opacity-100 transition-opacity w-56 p-3 bg-white dark:bg-[#0F1115] border border-slate-200 dark:border-[#2d3545] rounded-lg shadow-xl pointer-events-none">
                  <h4 className="text-slate-900 dark:text-white text-xs font-bold mb-1">Isolated Sandbox</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">Secure execution environments where untrusted agent code is run safely.</p>
                </div>
              </div>

              {/* Connector Label */}
              <div className="z-10 flex flex-col items-center gap-1">
                <div className="bg-white dark:bg-[#101622] px-2 py-1 rounded border border-slate-200 dark:border-[#2d3545] text-[10px] font-mono text-slate-500">Stream</div>
                <span className="material-symbols-outlined text-[12px] text-[#135bec] animate-pulse">lock</span>
              </div>

              {/* Node 3: Evaluations */}
              <div className="relative z-10 flex flex-col items-center gap-4 group/node cursor-pointer">
                <div className="w-40 h-24 bg-white dark:bg-[#1c212c] border-2 border-slate-200 dark:border-[#2d3545] rounded-xl flex flex-col items-center justify-center p-4 transition-all duration-300 glow-hover ring-1 ring-[#135bec]/20">
                  <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 group-hover/node:bg-[#135bec]/20 group-hover/node:text-[#135bec] transition-colors text-slate-400">
                    <span className="material-symbols-outlined">policy</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Evaluations</span>
                  <span className="text-[9px] uppercase tracking-widest text-[#135bec] font-bold mt-1">Safe Ops</span>
                </div>
                <div className="absolute top-28 opacity-0 group-hover/node:opacity-100 transition-opacity w-56 p-3 bg-white dark:bg-[#0F1115] border border-slate-200 dark:border-[#2d3545] rounded-lg shadow-xl pointer-events-none">
                  <h4 className="text-slate-900 dark:text-white text-xs font-bold mb-1">Policy Gate</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">Outputs are validated against pre-defined safety policies before release.</p>
                </div>
              </div>

              {/* Connector Label */}
              <div className="z-10 bg-white dark:bg-[#101622] px-2 py-1 rounded border border-slate-200 dark:border-[#2d3545] text-[10px] font-mono text-slate-500">Log</div>

              {/* Node 4: Artifacts */}
              <div className="relative z-10 flex flex-col items-center gap-4 group/node cursor-pointer">
                <div className="w-40 h-24 bg-white dark:bg-[#1c212c] border-2 border-slate-200 dark:border-[#2d3545] rounded-xl flex flex-col items-center justify-center p-4 transition-all duration-300 glow-hover">
                  <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 group-hover/node:bg-[#135bec]/20 group-hover/node:text-[#135bec] transition-colors text-slate-400">
                    <span className="material-symbols-outlined">database</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Artifacts</span>
                </div>
                <div className="absolute top-28 opacity-0 group-hover/node:opacity-100 transition-opacity w-56 p-3 bg-white dark:bg-[#0F1115] border border-slate-200 dark:border-[#2d3545] rounded-lg shadow-xl pointer-events-none">
                  <h4 className="text-slate-900 dark:text-white text-xs font-bold mb-1">Immutable Storage</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">Persistent storage for agent outputs, logs, and traceability data.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deep Dive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-white dark:bg-[#1c212c] border border-slate-200 dark:border-[#2d3545] hover:border-[#135bec]/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white group-hover:bg-[#135bec] group-hover:text-white transition-colors">
                <span className="material-symbols-outlined">account_tree</span>
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold text-lg">Traceability Spine</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-4">
              The central nervous system of Reach. Every action, decision, and output is logged to an immutable ledger, providing 100% auditability for enterprise compliance.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white dark:bg-[#1c212c] border border-slate-200 dark:border-[#2d3545] hover:border-[#135bec]/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white group-hover:bg-[#135bec] group-hover:text-white transition-colors">
                <span className="material-symbols-outlined">verified_user</span>
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold text-lg">Safe Ops Protocol</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-4">
              Our proprietary safety layer intercepts all agent actions. Policies are evaluated in real-time to prevent hallucinations or unauthorized resource access.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white dark:bg-[#1c212c] border border-slate-200 dark:border-[#2d3545] hover:border-[#135bec]/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white group-hover:bg-[#135bec] group-hover:text-white transition-colors">
                <span className="material-symbols-outlined">terminal</span>
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold text-lg">Developer SDK</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-4">
              Integrate Reach into your existing stack with our type-safe SDKs. Built for TypeScript and Python, designed for instant productivity.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
