import React from 'react';

export function TransparencyGovernance() {
  return (
    <main className="flex-grow bg-white dark:bg-[#101622] text-slate-900 dark:text-slate-100">
      {/* Hero Section */}
      <section className="relative px-6 py-12 lg:px-20 lg:py-16 border-b border-slate-200 dark:border-[#282e39] bg-white dark:bg-[#111318] overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-8 md:items-end relative z-10">
          <div className="flex flex-col gap-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold uppercase tracking-wider w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              System Integrity: Optimal
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
              Transparency & <br/>
              <span className="text-transparent bg-clip-text bg-linear-to-r from-[#135bec] to-blue-400">Governance Posture</span>
            </h1>
            <p className="text-slate-600 dark:text-[#9da6b9] text-lg max-w-2xl leading-relaxed">
              Public verification for ReadyLayer Agentic Orchestration Control Plane. Our security architecture is built on three immutable pillars ensuring zero-trust compliance for enterprise workloads.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Last Verified Audit</div>
            <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white text-right">2023-10-24 <span className="text-slate-500 text-lg">14:02 UTC</span></div>
          </div>
        </div>
      </section>

      {/* Governance Grid */}
      <section className="px-6 py-12 lg:px-20 bg-slate-50 dark:bg-[#0d1117]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                title: 'Row Level Security (RLS)', 
                desc: 'Enforced strictly at the database layer. No query can bypass tenant isolation logic, preventing unauthorized cross-contamination of data.',
                status: 'ENFORCED',
                icon: 'database'
              },
              { 
                title: 'Immutable Audit Logs', 
                desc: 'Write-once, read-many (WORM) architecture ensuring forensic integrity. Every agent action is cryptographically signed and stored.',
                status: 'ACTIVE RECORDING',
                icon: 'verified_user'
              },
              { 
                title: 'Least Privilege Access', 
                desc: 'Zero-trust default policy applied to every agentic operation. Agents only request permissions necessary for the specific task context.',
                status: 'ZERO TRUST',
                icon: 'lock'
              }
            ].map((card) => (
              <div key={card.title} className="group relative flex flex-col gap-4 p-6 rounded-xl border border-slate-200 dark:border-[#3b4354] bg-white dark:bg-[#1c1f27] hover:border-[#135bec]/50 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-[#135bec]/5">
                <div className="absolute top-6 right-6">
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                </div>
                <div className="p-3 bg-[#135bec]/10 w-fit rounded-lg text-[#135bec]">
                  <span className="material-symbols-outlined text-[32px]">{card.icon}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{card.title}</h3>
                  <p className="text-slate-600 dark:text-[#9da6b9] text-sm leading-relaxed">
                    {card.desc}
                  </p>
                </div>
                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Status: {card.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Traceability Spine & Scoring */}
      <section className="px-6 py-16 lg:px-20 bg-white dark:bg-[#101622] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.03] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 relative z-10">
          <div className="flex-1 flex flex-col gap-10">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Determining Intent via Weighted Scoring</h2>
              <p className="text-slate-600 dark:text-[#9da6b9] leading-relaxed mb-6">
                We prioritize deterministic, canonical commands over probabilistic generation to ensure safety and predictability in agent actions. Our scoring engine evaluates intent against a strict whitelist of safe operations.
              </p>
              <div className="flex gap-4 items-center mb-8">
                <div className="px-4 py-2 bg-slate-100 dark:bg-[#1e293b] rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold block mb-1">Canonical Match</span>
                  <span className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">&gt; 98.5%</span>
                </div>
                <div className="px-4 py-2 bg-slate-100 dark:bg-[#1e293b] rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold block mb-1">Hallucination Rate</span>
                  <span className="text-xl font-mono font-bold text-[#135bec]">&lt; 0.01%</span>
                </div>
              </div>
            </div>
            
            <div className="p-6 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="material-symbols-outlined text-6xl text-white">security</span>
              </div>
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#135bec]">toggle_on</span>
                Operational Safety Controls
              </h3>
              <div className="space-y-4">
                {[
                  { name: 'Circuit Breakers', desc: 'Auto-trip on anomaly detection > 3σ', status: 'ARMED', color: 'emerald' },
                  { name: 'Degraded Mode', desc: 'Safe-fail protocols for API outages', status: 'STANDBY', color: 'slate' },
                  { name: 'Human-in-the-Loop', desc: 'Required for high-stakes financial ops', status: 'ACTIVE', color: 'emerald' },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${item.color === 'emerald' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-500'}`}></div>
                      <div>
                        <div className="text-sm font-bold">{item.name}</div>
                        <div className="text-xs text-slate-400">{item.desc}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded ${item.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'} text-xs font-mono font-bold`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[500px] flex items-center justify-center relative">
            <div className="w-full h-full rounded-2xl border border-slate-200 dark:border-[#3b4354] bg-white dark:bg-[#1c1f27] p-8 relative overflow-hidden shadow-inner flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-[#135bec] to-transparent opacity-50"></div>
              
              {[
                { title: 'Input Ingestion', sub: 'Sanitization & Tokenization', icon: 'input', complete: true },
                { title: 'Intent Classification', sub: 'Weighted Scoring Analysis', icon: 'psychology', active: true, progress: 85 },
                { title: 'Governance Check', sub: 'RLS & Policy Validation', icon: 'gavel' },
                { title: 'Immutable Log', sub: 'Final State Commitment', icon: 'receipt_long' },
              ].map((step, idx, arr) => (
                <div key={step.title} className="flex gap-4 items-center group relative z-10">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                      step.active ? 'bg-[#135bec]/20 border-[#135bec] text-[#135bec] shadow-[0_0_15px_rgba(19,91,236,0.3)]' : 
                      'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-400'
                    }`}>
                      <span className="material-symbols-outlined text-sm">{step.icon}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className={`h-12 w-0.5 my-2 transition-colors ${
                        step.active ? 'bg-linear-to-b from-[#135bec] to-slate-200 dark:to-slate-700' : 
                        'bg-slate-200 dark:bg-slate-700'
                      }`}></div>
                    )}
                  </div>
                  <div className={idx < arr.length - 1 ? 'pb-8' : ''}>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</h4>
                    <p className="text-xs text-slate-500">{step.sub}</p>
                    {step.progress && (
                      <div className="mt-2 h-1.5 w-32 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-[#135bec] rounded-full" style={{ width: `${step.progress}%` }}></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="absolute top-1/2 right-0 -translate-y-1/2 w-64 h-64 bg-[#135bec]/10 rounded-full blur-3xl pointer-events-none"></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
