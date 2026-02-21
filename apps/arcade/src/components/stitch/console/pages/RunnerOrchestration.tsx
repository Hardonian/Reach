'use client';

import React from 'react';

export function RunnerOrchestration() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#101622]">
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-[#2d3748] bg-[#111318]/50 backdrop-blur-sm flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center text-sm text-slate-400 font-medium font-sans">
            <span className="hover:text-white cursor-pointer">Console</span>
            <span className="mx-2 text-slate-600">/</span>
            <span className="hover:text-white cursor-pointer">Orchestration</span>
            <span className="mx-2 text-slate-600">/</span>
            <span className="text-white">Runners</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">System Healthy</span>
          </div>
          <div className="h-8 w-px bg-[#2d3748]"></div>
          <button className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <button className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-[20px]">help</span>
          </button>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Runner Orchestration</h1>
              <p className="text-slate-400 mt-1">Manage execution environments, schedule jobs, and monitor active agents.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#1c232e] border border-[#2d3748] rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-sm font-medium">
                <span className="material-symbols-outlined text-[18px]">history</span>
                View Audit Logs
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#135bec] hover:bg-[#135bec]/90 rounded-lg text-white transition-colors text-sm font-medium shadow-lg shadow-[#135bec]/20">
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Schedule
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Active Runners', value: '12', trend: '+2', icon: 'bolt', color: 'primary' },
              { label: 'Queued Jobs', value: '8', trend: '0', icon: 'hourglass_top', color: 'warning' },
              { label: 'Est. Hourly Cost', value: '$4.20', trend: '15%', icon: 'attach_money', color: 'slate' },
              { label: 'Success Rate', value: '98.5%', trend: '0.5%', icon: 'check_circle', color: 'emerald' },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#1c232e] border border-[#2d3748] rounded-xl p-5 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-slate-400 text-sm font-medium">{stat.label}</span>
                  <span className={`material-symbols-outlined text-[20px] ${stat.color === 'primary' ? 'text-[#135bec]' : stat.color === 'warning' ? 'text-amber-500' : stat.color === 'emerald' ? 'text-emerald-500' : 'text-slate-400'}`}>{stat.icon}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-white font-sans">{stat.value}</span>
                  <span className={`text-emerald-400 text-sm font-medium mb-1 flex items-center`}>
                    <span className="material-symbols-outlined text-[14px]">arrow_upward</span> {stat.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-4 flex flex-col gap-6">
              <div className="bg-[#1c232e] border border-[#2d3748] rounded-xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-[#2d3748] bg-[#161b24]/50">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#135bec] text-[20px]">rocket_launch</span>
                    Trigger Runner
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">Configure and dispatch a new agentic instance.</p>
                </div>
                <div className="p-5 flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Target Repository</label>
                    <select className="w-full bg-[#101622] border border-[#2d3748] rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-[#135bec] outline-none">
                      <option>reach-core/main</option>
                      <option>reach-web/develop</option>
                      <option>reach-api/staging</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Execution Mode</label>
                    <div className="grid grid-cols-2 bg-[#101622] p-1 rounded-lg border border-[#2d3748]">
                      <button className="py-2 rounded-md text-sm font-medium text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">science</span>
                        Dry-run
                      </button>
                      <button className="bg-[#135bec] text-white py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">bolt</span>
                        Live
                      </button>
                    </div>
                  </div>
                  <button className="w-full flex items-center justify-center gap-2 bg-[#135bec] hover:bg-[#135bec]/90 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-[#135bec]/20">
                    <span>Dispatch Runner</span>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#1c232e] border border-[#2d3748] rounded-xl overflow-hidden flex flex-col flex-1 min-h-[300px]">
                <div className="p-4 border-b border-[#2d3748] bg-[#161b24]/50 flex justify-between items-center">
                  <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
                    Recent Failures
                  </h3>
                  <button className="text-xs text-[#135bec] hover:underline">View All</button>
                </div>
                <div className="flex flex-col divide-y divide-[#2d3748] overflow-y-auto max-h-[400px]">
                   {[
                     { id: '#RUN-8921', time: '2m ago', error: 'Timeout waiting for API response', type: 'Critical Error', color: 'red' },
                     { id: '#RUN-8919', time: '14m ago', error: 'Context window exceeded limit', type: 'Token Limit', color: 'amber' },
                     { id: '#RUN-8840', time: '1h ago', error: 'Invalid configuration yaml', type: 'Config Error', color: 'red' },
                   ].map((fail) => (
                    <div key={fail.id} className="p-4 hover:bg-white/5 transition-colors group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-mono text-slate-400">{fail.id}</span>
                        <span className="text-[10px] text-slate-500">{fail.time}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-200 mb-2">{fail.error}</p>
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium bg-${fail.color}-500/10 text-${fail.color}-400 border border-${fail.color}-500/20`}>{fail.type}</span>
                        <button className="opacity-0 group-hover:opacity-100 p-1.5 bg-slate-700 hover:bg-[#135bec] text-white rounded transition-all">
                          <span className="material-symbols-outlined text-[16px]">replay</span>
                        </button>
                      </div>
                    </div>
                   ))}
                </div>
              </div>
            </div>

            <div className="xl:col-span-8 flex flex-col gap-6">
              <div className="bg-[#1c232e] border border-[#2d3748] rounded-xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-[#2d3748] bg-[#161b24]/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                       <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#135bec] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#135bec]"></span>
                      </span>
                      Active Executions
                    </h3>
                    <span className="bg-[#135bec]/20 text-[#135bec] text-xs px-2 py-0.5 rounded-full font-mono">5 Running</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-[#2d3748] bg-[#161b24]">
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider">Run ID</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider">Target</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider w-32">Progress</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d3748] text-sm text-slate-300">
                       {[
                         { id: '#RUN-9021', target: 'reach-core', status: 'Reasoning', progress: 45, color: 'emerald' },
                         { id: '#RUN-9020', target: 'reach-api', status: 'Analyzing', progress: 12, color: 'blue' },
                         { id: '#RUN-9018', target: 'reach-web', status: 'Generating', progress: 88, color: 'purple' },
                       ].map((run) => (
                        <tr key={run.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-5 py-4 font-mono text-[#135bec] cursor-pointer">{run.id}</td>
                          <td className="px-5 py-4 text-white">{run.target}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-${run.color}-500/10 text-${run.color}-400 border border-${run.color}-500/20`}>
                              {run.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-slate-700 rounded-full h-1.5">
                                <div className="bg-[#135bec] h-1.5 rounded-full" style={{ width: `${run.progress}%` }}></div>
                              </div>
                              <span className="text-xs text-slate-400 w-8">{run.progress}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button className="text-slate-500 hover:text-red-500 transition-colors">
                              <span className="material-symbols-outlined text-[20px]">cancel</span>
                            </button>
                          </td>
                        </tr>
                       ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
