import React from 'react';
import { TracePill } from '@/components/trace/TracePill';

export interface AgentEntry {
  id: string;
  name: string;
  org: string;
  repo: string;
  version: string;
  capabilities: string[];
  health: 'Healthy' | 'Degraded' | 'Critical' | 'Offline';
  errorRate: string;
  lastRun: string;
  lastRunId: string;
  isEnabled: boolean;
  icon: string;
  iconColor: string;
}

interface AgentTableProps {
  agents: AgentEntry[];
}

export function AgentTable({ agents }: AgentTableProps) {
  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/50 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider cursor-pointer hover:text-slate-200" scope="col">
                <div className="flex items-center gap-1">Agent Name <span className="material-symbols-outlined text-[14px]">arrow_downward</span></div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider" scope="col">Repo & Version</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider" scope="col">Capabilities</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider cursor-pointer hover:text-slate-200" scope="col">
                <div className="flex items-center gap-1">Health</div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider" scope="col">Error Rate</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider" scope="col">Last Run</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider" scope="col">State</th>
              <th className="relative px-6 py-3 border-b border-slate-800" scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {agents.map((agent) => (
              <tr key={agent.id} className={`hover:bg-slate-800/50 transition-colors group ${!agent.isEnabled ? 'opacity-70' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 h-9 w-9 bg-${agent.iconColor}-500/20 rounded-lg flex items-center justify-center text-${agent.iconColor}-400 border border-${agent.iconColor}-500/30`}>
                      <span className="material-symbols-outlined text-[20px]">{agent.icon}</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-white">{agent.name}</div>
                      <div className="text-xs text-slate-500">{agent.org}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <a className="text-xs text-[#135bec] hover:underline flex items-center gap-1" href="#">
                      <span className="material-symbols-outlined text-[12px]">code</span>
                      {agent.repo}
                    </a>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300 w-fit">{agent.version}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {agent.capabilities.map((cap) => (
                      <span key={cap} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 border border-slate-700 text-slate-400">{cap}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    agent.health === 'Healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    agent.health === 'Degraded' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    agent.health === 'Critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    'bg-slate-700 text-slate-400 border-slate-600'
                  }`}>
                    {agent.health === 'Healthy' && (
                       <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                    {agent.health !== 'Healthy' && (
                       <span className={`h-2 w-2 rounded-full ${
                        agent.health === 'Degraded' ? 'bg-amber-500' :
                        agent.health === 'Critical' ? 'bg-rose-500' :
                        'bg-slate-400'
                       }`}></span>
                    )}
                    {agent.health}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className={`text-sm font-mono ${
                      parseFloat(agent.errorRate) > 10 ? 'text-rose-400' : 
                      parseFloat(agent.errorRate) > 1 ? 'text-amber-400' :
                      'text-slate-300'
                    }`}>{agent.errorRate}</span>
                    <div className="w-16 h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full ${
                         parseFloat(agent.errorRate) > 10 ? 'bg-rose-500' : 
                         parseFloat(agent.errorRate) > 1 ? 'bg-amber-500' :
                         'bg-emerald-500'
                      }`} style={{ width: agent.errorRate }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-300">{agent.lastRun}</span>
                    <TracePill traceId={agent.lastRunId} />
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={agent.isEnabled} className="sr-only peer" readOnly aria-label={`Enable or disable ${agent.name}`} />
                    <div className="relative w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#135bec] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#135bec]"></div>
                  </label>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" className="text-slate-400 hover:text-white p-1" title="View Audit Trail">
                      <span className="material-symbols-outlined text-[18px]">history</span>
                    </button>
                    <button type="button" className="text-slate-400 hover:text-white p-1" title="More Actions">
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
