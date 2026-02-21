'use client';

import React from 'react';

const artifacts = [
  { name: 'agent-pack-v2.4.0.tar.gz', type: 'Agent Pack', size: '14.2 MB', status: 'Signed', created: '2h ago', hash: 'sha256:a3f1...b92e' },
  { name: 'eval-dataset-jan.parquet', type: 'Dataset', size: '842 MB', status: 'Unsigned', created: '1d ago', hash: 'sha256:c7a9...d01f' },
  { name: 'runner-snapshot-prod.img', type: 'Runner Image', size: '2.1 GB', status: 'Signed', created: '3d ago', hash: 'sha256:f82b...7c44' },
  { name: 'governance-policy-v3.json', type: 'Policy Bundle', size: '48 KB', status: 'Signed', created: '5d ago', hash: 'sha256:09e3...a15d' },
];

const statusColor: Record<string, string> = {
  Signed: 'emerald',
  Unsigned: 'amber',
  Expired: 'red',
};

export function ArtifactRegistry() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#101622] font-sans">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#282e39] bg-[#111318] px-10 py-5">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase tracking-widest text-[#135bec]">Artifact Registry</h2>
          <p className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wide">Signed build outputs, snapshots & policy bundles</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Upload Artifact
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 md:p-12 max-w-[1600px] mx-auto w-full flex flex-col gap-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Artifacts', value: '48', color: 'blue' },
            { label: 'Signed', value: '45', color: 'emerald' },
            { label: 'Awaiting Signature', value: '3', color: 'amber' },
            { label: 'Storage Used', value: '18.7 GB', color: 'slate' },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#1e293b] rounded-2xl border border-slate-700/50 p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9da6b9] mb-2">{stat.label}</p>
              <p className={`text-3xl font-black text-${stat.color}-400`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search artifacts by name, hash, or type..."
              className="w-full bg-[#1e293b] border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#135bec]"
            />
          </div>
          <select
            className="bg-[#1e293b] border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-[#9da6b9] focus:outline-none focus:ring-1 focus:ring-[#135bec]"
            aria-label="Filter by artifact type"
          >
            <option>All Types</option>
            <option>Agent Pack</option>
            <option>Dataset</option>
            <option>Runner Image</option>
            <option>Policy Bundle</option>
          </select>
        </div>

        {/* Artifact Table */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-left font-sans">
            <thead className="bg-[#111318] text-[10px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-8 py-4">Name</th>
                <th className="px-8 py-4">Type</th>
                <th className="px-8 py-4">Size</th>
                <th className="px-8 py-4">Signature</th>
                <th className="px-8 py-4">Hash</th>
                <th className="px-8 py-4 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {artifacts.map((artifact) => {
                const color = statusColor[artifact.status] ?? 'slate';
                return (
                  <tr key={artifact.name} className="hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-5 font-mono text-white text-[11px]">{artifact.name}</td>
                    <td className="px-8 py-5 text-[#9da6b9] font-bold uppercase tracking-widest text-[10px]">{artifact.type}</td>
                    <td className="px-8 py-5 text-[#9da6b9]">{artifact.size}</td>
                    <td className="px-8 py-5">
                      <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>
                        {artifact.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-mono text-slate-500 text-[10px]">{artifact.hash}</td>
                    <td className="px-8 py-5 text-right text-[#9da6b9]">{artifact.created}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
