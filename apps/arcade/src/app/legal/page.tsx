'use client';

import { useState } from 'react';
import Link from 'next/link';

type LegalTab = 'privacy' | 'terms' | 'cookies';

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState<LegalTab>('privacy');

  return (
    <div className="section-container py-16">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Legal Center</h1>
          <p className="text-gray-400">Governance and compliance information for the ReadyLayer ecosystem.</p>
        </header>

        <div className="flex flex-col md:flex-row gap-12">
          {/* Sidebar Nav */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <nav className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab('privacy')}
                className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'privacy'
                    ? 'bg-accent text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Privacy Policy
              </button>
              <button
                onClick={() => setActiveTab('terms')}
                className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'terms'
                    ? 'bg-accent text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Terms of Service
              </button>
              <button
                onClick={() => setActiveTab('cookies')}
                className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'cookies'
                    ? 'bg-accent text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Cookie Policy
              </button>
              <div className="mt-8 pt-8 border-t border-border">
                <Link
                  href="/security"
                  className="text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-between"
                >
                  Security Reporting
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
              </div>
            </nav>
          </aside>

          {/* Content Area */}
          <main className="flex-1 min-w-0 bg-surface border border-border rounded-2xl p-8 md:p-12 animate-in fade-in duration-500">
            {activeTab === 'privacy' && (
              <div className="prose prose-invert prose-emerald max-w-none">
                <h2 className="text-2xl font-bold mb-4">Privacy Policy</h2>
                <p className="text-gray-500 text-sm mb-8">Last updated: February 20, 2026</p>
                
                <section className="mb-10">
                  <h3 className="text-xl font-bold mb-3 text-emerald-400">1. Data Sovereignty</h3>
                  <p className="text-gray-300 leading-relaxed">
                    ReadyLayer is designed with "Data Sovereignty First" principles. By default, ReadyLayer operates
                    in your infrastructure. We only collect the minimal metadata required to orchestrate
                    determinstic execution packs across your distributed nodes.
                  </p>
                </section>

                <section className="mb-10">
                  <h3 className="text-xl font-bold mb-3 text-emerald-400">2. Information We Collect</h3>
                  <ul className="list-disc pl-5 text-gray-300 space-y-2">
                    <li><strong className="text-white">Authentication Data:</strong> User IDs and tenant associations via your chosen identity provider.</li>
                    <li><strong className="text-white">Orchestration Metadata:</strong> Run IDs, status transitions, and tool capability references.</li>
                    <li><strong className="text-white">Telemetry:</strong> Anonymous performance metrics for engine optimization (opt-out available).</li>
                  </ul>
                </section>

                <section className="mb-10">
                  <h3 className="text-xl font-bold mb-3 text-emerald-400">3. Data Retention</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Audit logs and execution capsules are retained for 30 days by default in the managed service.
                    Self-hosted instances allow for indefinite retention policies managed by the operator.
                  </p>
                </section>

                <section className="mb-10">
                  <h3 className="text-xl font-bold mb-3 text-emerald-400">4. Your Rights</h3>
                  <p className="text-gray-300 leading-relaxed">
                    You have the right to access, export, or delete your tenant data at any time via the
                    ReadyLayer Dashboard or the <code>reach account purge</code> CLI command.
                  </p>
                </section>
              </div>
            )}

            {activeTab === 'terms' && (
              <div className="prose prose-invert prose-blue max-w-none">
                <h2 className="text-2xl font-bold mb-4">Terms of Service</h2>
                <p className="text-gray-500 text-sm mb-8">Last updated: February 20, 2026</p>
                
                <section className="mb-10">
                  <h3 className="text-xl font-bold mb-3 text-blue-400">1. Service Definition</h3>
                  <p className="text-gray-300 leading-relaxed">
                    ReadyLayer provides a deterministic execution fabric and reliability suite for agentic systems. 
                    Users are responsible for the logic and prompts deployed via the platform.
                  </p>
                </section>

                <section className="mb-10">
                  <h3 className="text-xl font-bold mb-3 text-blue-400">2. Responsible Use</h3>
                  <p className="text-gray-300 leading-relaxed">
                    You agree not to use ReadyLayer for any illegal, harmful, or abusive activities. 
                    Automated testing against public infrastructure must respect robots.txt and rate limits.
                  </p>
                </section>

                <section className="mb-10">
                  <h3 className="text-xl font-bold mb-3 text-blue-400">3. Deterministic Integrity</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Any tampering with signed audit logs or execution capsules violates the core trust model 
                    of the protocol and may result in immediate suspension of service.
                  </p>
                </section>
              </div>
            )}

            {activeTab === 'cookies' && (
              <div className="prose prose-invert prose-amber max-w-none">
                <h2 className="text-2xl font-bold mb-4">Cookie Policy</h2>
                <p className="text-gray-500 text-sm mb-8">Last updated: February 20, 2026</p>
                
                <section className="mb-10">
                  <h3 className="text-xl font-bold mb-3 text-amber-400">1. Necessary Cookies</h3>
                  <p className="text-gray-300 leading-relaxed">
                    We use strictly necessary cookies for session management, authentication, and security. 
                    These cannot be disabled as they are required for the fabric to function.
                  </p>
                </section>

                <section className="mb-10">
                  <h3 className="text-xl font-bold mb-3 text-amber-400">2. Performance & Analytics</h3>
                  <p className="text-gray-300 leading-relaxed">
                    We use basic telemetry to understand engine performance and UI usage patterns. 
                    No PII is stored in these cookies.
                  </p>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
