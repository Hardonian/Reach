import React from 'react';

export function MarketplaceTemplates() {
  const templates = [
    { title: 'Financial Analyst', version: 'v2.4.0', org: 'ReadyLayer Official', rating: 4.9, desc: 'Autonomous agent designed for anomaly detection in financial reports. Integrates with Quickbooks and Xero APIs.', deploys: '12k deploys', icon: 'query_stats', color: 'blue' },
    { title: 'Support Triager', version: 'v1.1.0', org: 'ReadyLayer Official', rating: 4.7, desc: 'First-line support agent that classifies tickets, drafts responses, and escalates complex issues to human agents.', deploys: '8.5k deploys', icon: 'support_agent', color: 'purple' },
    { title: 'Code Reviewer', version: 'v3.0.1', org: 'Community', rating: 4.8, desc: 'Automatically reviews PRs for style violations, security vulnerabilities, and test coverage.', deploys: '5.2k deploys', icon: 'code', color: 'green' },
  ];

  const runners = [
    { name: 'Healthcare Shield', tag: 'HIPAA', desc: 'Strict PII redaction and audit logs enabled by default.', icon: 'local_hospital', color: 'rose' },
    { name: 'FinTech Secure', tag: 'SOC2', desc: 'Isolated memory containers with zero-retention policies.', icon: 'account_balance', color: 'amber' },
    { name: 'E-Commerce Core', tag: 'PCI-DSS', desc: 'Transaction monitoring and fraud detection preset.', icon: 'shopping_cart', color: 'cyan' },
    { name: 'EU Compliance', tag: 'GDPR', desc: 'Data residency locks and user consent workflows.', icon: 'public', color: 'emerald' },
  ];

  return (
    <div className="flex flex-1 overflow-hidden bg-[#101622]">
      {/* Sidebar Navigation */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-[#283040] bg-[#101622] overflow-y-auto">
        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-[#9da6b9] uppercase tracking-wider mb-3">Browse</h3>
            <nav className="flex flex-col gap-1">
              <a className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#135bec]/10 text-[#135bec]" href="#">
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
                <span className="text-sm font-medium">All Templates</span>
              </a>
              {[
                { icon: 'smart_toy', label: 'Agent Templates' },
                { icon: 'dns', label: 'Runner Pre-sets' },
                { icon: 'extension', label: 'Integrations' },
                { icon: 'group', label: 'Community' },
              ].map((item) => (
                <a key={item.label} className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#9da6b9] hover:text-white hover:bg-white/5 transition-colors" href="#">
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </a>
              ))}
            </nav>
          </div>
          <div className="h-px bg-[#283040] w-full"></div>
          <div>
            <h3 className="text-xs font-semibold text-[#9da6b9] uppercase tracking-wider mb-3">Industries</h3>
            <div className="flex flex-col gap-1">
              {['Finance', 'Healthcare', 'DevOps', 'Customer Support'].map((industry) => (
                <label key={industry} className="flex items-center gap-3 px-3 py-1.5 cursor-pointer group">
                  <input className="h-4 w-4 rounded border-[#283040] bg-[#1a2230] text-[#135bec] focus:ring-0 focus:ring-offset-0" type="checkbox"/>
                  <span className="text-sm text-[#9da6b9] group-hover:text-white transition-colors">{industry}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-auto pt-6">
            <div className="rounded-xl bg-linear-to-br from-[#1a2230] to-[#135bec]/10 border border-[#283040] p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="p-1.5 bg-[#135bec] rounded-lg">
                  <span className="material-symbols-outlined text-white text-[18px]">rocket_launch</span>
                </div>
                <span className="text-[10px] font-bold bg-[#135bec]/20 text-[#135bec] px-2 py-0.5 rounded">NEW</span>
              </div>
              <h4 className="text-sm font-semibold text-white mb-1">Enterprise Runner</h4>
              <p className="text-xs text-[#9da6b9] mb-3">Dedicated instances with SOC2 compliance built-in.</p>
              <button type="button" className="w-full py-1.5 rounded-lg bg-[#1a2230] border border-[#283040] hover:bg-[#283040] text-xs font-medium text-white transition-colors">Learn More</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#101622]">
        <div className="max-w-[1400px] mx-auto p-6 md:p-8 lg:p-12 space-y-10">
          <section className="space-y-6">
            <div className="max-w-3xl">
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">ReadyLayer Marketplace</h1>
              <p className="text-lg text-[#9da6b9] leading-relaxed">
                Accelerate your AI workforce. Discover pre-built agent templates, secure runner configurations, and community-driven workflows ready to deploy.
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9da6b9] group-focus-within:text-[#135bec] transition-colors">
                  <span className="material-symbols-outlined">search</span>
                </div>
                <input className="block w-full pl-10 pr-4 py-3 rounded-lg bg-[#1a2230] border border-[#283040] text-white placeholder-[#9da6b9] focus:ring-2 focus:ring-[#135bec]/50 focus:border-[#135bec] outline-none transition-all" placeholder="Search templates, runners, and integrations..." type="text"/>
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                  <kbd className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#101622] border border-[#283040] text-xs text-[#9da6b9]">⌘K</kbd>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#1a2230] border border-[#283040] text-[#9da6b9] hover:text-white hover:border-[#135bec]/50 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  <span className="text-sm font-medium">Filters</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-[#9da6b9] py-1 mr-2">Trending:</span>
              {['Financial Analyst', 'HIPAA Runner', 'Slack Bot', 'Data Scraper'].map((tag) => (
                <a key={tag} className="px-3 py-1 rounded-full bg-[#283040]/50 hover:bg-[#135bec]/20 hover:text-[#135bec] text-xs font-medium text-[#9da6b9] border border-transparent hover:border-[#135bec]/20 transition-all font-sans" href="#">{tag}</a>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Featured Agent Templates</h2>
                <p className="text-sm text-[#9da6b9]">High-performance agents curated by the ReadyLayer team.</p>
              </div>
              <a className="text-sm font-medium text-[#135bec] hover:underline flex items-center gap-1" href="#">
                View All <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {templates.map((card) => (
                <div key={card.title} className="group relative flex flex-col rounded-xl border border-[#283040] bg-[#1a2230] p-5 hover:border-[#135bec]/50 hover:shadow-[0_0_20px_-10px_rgba(19,91,236,0.3)] transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-lg bg-${card.color}-500/10 text-${card.color}-500 flex items-center justify-center border border-${card.color}-500/20`}>
                        <span className="material-symbols-outlined">{card.icon}</span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-[#135bec] transition-colors">{card.title}</h3>
                        <p className="text-xs text-[#9da6b9]">{card.version} • {card.org}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-[#101622] px-2 py-1 rounded text-xs font-medium text-[#9da6b9]">
                      <span className="material-symbols-outlined text-[14px] text-yellow-500">star</span>
                      <span className="text-white">{card.rating}</span>
                    </div>
                  </div>
                  <p className="text-sm text-[#9da6b9] mb-6 line-clamp-2">{card.desc}</p>
                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-[#283040]/50">
                    <div className="flex items-center gap-2 text-xs text-[#9da6b9]">
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>{card.deploys}</span>
                    </div>
                    <button type="button" className="px-3 py-1.5 rounded-lg bg-white text-[#101622] text-xs font-bold hover:bg-[#135bec] hover:text-white transition-colors">Deploy</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Industry Runners</h2>
                <p className="text-sm text-[#9da6b9]">Pre-configured environments compliant with industry standards.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {runners.map((runner) => (
                <div key={runner.name} className="group flex flex-col p-4 rounded-xl border border-[#283040] bg-linear-to-br from-[#1a2230] to-[#101622] hover:from-[#1a2230] hover:to-[#1a2230] hover:border-[#135bec]/30 transition-all cursor-pointer">
                  <div className="flex justify-between mb-3">
                    <div className={`p-2 rounded bg-${runner.color}-500/10 text-${runner.color}-500`}>
                      <span className="material-symbols-outlined">{runner.icon}</span>
                    </div>
                    <span className={`bg-${runner.color}-500/10 text-${runner.color}-500 text-[10px] font-bold px-2 py-1 rounded h-fit`}>{runner.tag}</span>
                  </div>
                  <h3 className="font-bold text-white mb-1">{runner.name}</h3>
                  <p className="text-xs text-[#9da6b9] mb-4">{runner.desc}</p>
                  <div className="mt-auto flex items-center text-xs font-medium text-[#135bec] group-hover:underline">
                    Configure Runner <span className="material-symbols-outlined text-[14px] ml-1">chevron_right</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="py-10 border-t border-[#283040]">
            <div className="rounded-2xl bg-linear-to-r from-[#135bec]/20 via-[#1a2230] to-[#1a2230] border border-[#283040] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
              <div className="absolute -top-20 -left-20 size-64 bg-[#135bec]/20 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="relative z-10 max-w-xl">
                <h2 className="text-2xl font-bold text-white mb-2">Can't find what you're looking for?</h2>
                <p className="text-[#9da6b9]">Build your own custom agent from scratch using our SDK or request a specific template from our engineering team.</p>
              </div>
              <div className="relative z-10 flex gap-4">
                <button type="button" className="px-5 py-2.5 rounded-lg border border-[#283040] bg-[#101622] text-white text-sm font-medium hover:bg-[#283040] transition-colors">Request Template</button>
                <button type="button" className="px-5 py-2.5 rounded-lg bg-[#135bec] text-white text-sm font-bold hover:bg-[#135bec]/90 transition-colors shadow-lg shadow-[#135bec]/20">Build Custom Agent</button>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
