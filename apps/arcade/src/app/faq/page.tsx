'use client';

import { useState, useMemo } from 'react';
import { Metadata } from 'next';

const faqs = [
  {
    category: 'General',
    question: 'What is Reach?',
    answer: 'Reach is a deterministic execution fabric designed for agentic workloads. It ensures that any agent execution can be replayed, audited, and secured through signed execution packs and capability-based firewalls.'
  },
  {
    category: 'Architecture',
    question: 'Is Reach multi-tenant?',
    answer: 'Yes, Reach is built for multi-tenancy. It supports isolated execution environments, organization-specific policy profiles, and granular access controls for distributed nodes.'
  },
  {
    category: 'Security',
    question: 'How does Row-Level Security (RLS) work in Reach?',
    answer: 'Reach enforces RLS at the database and API layer. Every data access request is validated against the active session context and signed security tokens to ensure data isolation between tenants.'
  },
  {
    category: 'Data Privacy',
    question: 'Is my data stored by Reach?',
    answer: 'Reach follows a "Your Data, Your Control" policy. By default, Reach can operate in an offline-first or self-hosted mode where all execution logs, capsules, and vector data remain within your infrastructure.'
  },
  {
    category: 'Integration',
    question: 'How does MCP integrate with Reach?',
    answer: 'Reach implements the Model Context Protocol (MCP) as its primary tool interface. Any MCP-compliant server can be registered as a capability within a Reach execution pack.'
  },
  {
    category: 'Licensing',
    question: 'Is Reach Open Source?',
    answer: 'The core Reach protocol, deterministic engine, and CLI are open-source under the Apache License 2.0. Enterprise orchestration and management features are available as a hosted or managed service.'
  },
  {
    category: 'Pricing',
    question: 'What are the pricing tiers?',
    answer: 'Reach offers Free (Developer), Pro (Scaling Teams), and Enterprise tiers. Pricing is based on concurrent execution limits, audit log retention, and advanced governance features.'
  },
  {
    category: 'Orchestration',
    question: 'How does orchestration work?',
    answer: 'Reach uses a Planner-Executor model. The Planner generates a signed execution envelope (Phase 1), which is then validated and run by the Executor (Phase 2) under strict policy constraints.'
  },
  {
    category: 'Governance',
    question: 'How are agents governed?',
    answer: 'Agents are governed by Capability Shards. Every tool call or system access must be pre-authorized in a signed manifest. Unauthorized actions result in immediate termination of the execution process.'
  },
  {
    category: 'Security',
    question: 'What is the security model?',
    answer: 'Reach uses a 3-layer model: 1. Immutable Signed Packs, 2. Capability Firewalls, and 3. Automatic Boundary Redaction of secrets and PII.'
  },
  {
    category: 'CLI',
    question: 'What is the difference between CLI and Web versions?',
    answer: 'The CLI (reach) is the authoritative diagnostic and execution tool for local and edge environments. The Arcade (Web) is a premium management and observability layer for distributed orchestration.'
  },
  {
    category: 'Data',
    question: 'How are vector stores used?',
    answer: 'Reach uses vector stores for context retrieval and semantic policy matching. It supports pluggable vector backends including Pinecone, Milvus, and local SQLite-VSS.'
  },
  {
    category: 'Operations',
    question: 'What is the scaling strategy?',
    answer: 'Reach scales horizontally via federated nodes. The Session-Hub coordinates state across nodes, while the Runner handles local execution, allowing for infinite scaling across geographic regions.'
  },
  {
    category: 'Deployment',
    question: 'What are the deployment options?',
    answer: 'Reach can be deployed as a Docker container, a managed gRPC service, or a standalone binary on Linux, MacOS, Windows, and Android (via Termux).'
  },
  {
    category: 'LLM Support',
    question: 'Can I Bring Your Own LLM (BYOLLM)?',
    answer: 'Absolutely. Reach is model-agnostic. You can route tasks to any provider (Gemini, OpenAI, Anthropic) or local models (Ollama, vLLM) via standard MCP adapters.'
  },
  {
    category: 'Observability',
    question: 'How is observability handled?',
    answer: 'Reach generates structured OpenTelemetry-compatible event streams. These can be pushed to Prometheous, Grafana, or viewed live through the Reach Arcade Dashboard.'
  },
  {
    category: 'Resilience',
    question: 'How does Reach handle execution failures?',
    answer: 'Reach uses Bounded Retry Strategies and Deterministic Fallbacks. If a primary model fails, the engine can automatically retry with a safer model or escalate according to policy.'
  },
  {
    category: 'Enterprise',
    question: 'What rate limiting controls are available?',
    answer: 'Reach supports distributed rate limiting via Redis, allowing operators to set per-user, per-org, and per-model token or request quotas.'
  },
  {
    category: 'Enterprise',
    question: 'What enterprise controls are provided?',
    answer: 'Enterprise features include SSO/SAML integration, custom compliance reporting (SOC2/GDPR), audit log streaming, and dedicated support queues.'
  },
  {
    category: 'SLA',
    question: 'What is the SLA policy?',
    answer: 'Reach Enterprise offers a 99.99% uptime SLA for managed services and 4-hour critical response times for self-hosted instances with support contracts.'
  },
  {
    category: 'Compliance',
    question: 'What is the compliance posture?',
    answer: 'Reach is designed for high-compliance environments. It features tamper-evident audit logs, zero-trust execution, and localized data processing options.'
  },
  {
    category: 'Security',
    question: 'How is audit logging performed?',
    answer: 'Every state transition and tool call is logged with a cryptographic hash. These logs are aggregated into "Capsules" that can be verified for absolute proof of execution.'
  },
  {
    category: 'General',
    question: 'Does Reach support offline execution?',
    answer: 'Yes. Reach supports "Air-Gapped" mode where all capabilities and models are resolved locally, making it ideal for high-security or remote environment operations.'
  },
  {
    category: 'Community',
    question: 'Is there a marketplace for Reach packs?',
    answer: 'The Reach Marketplace allows developers to share signed connectors and execution packs. Every submission undergoes an automated security and determinism audit.'
  },
  {
    category: 'Future',
    question: 'What is on the roadmap?',
    answer: 'Upcoming features include Multi-Agent Orchestration Graphs, broader Edge Federation support, and enhanced "Self-Healing" execution policies.'
  }
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = useMemo(() => {
    return faqs.filter(faq => 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer
      }
    }))
  };

  return (
    <div className="section-container py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-gray-400">Everything you need to know about Reach architecture, security, and deployment.</p>
        </header>

        {/* Search Bar */}
        <div className="relative mb-12">
          <input
            type="text"
            placeholder="Search FAQs (architecture, security, pricing...)"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-12 text-lg focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-light"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, index) => (
              <div 
                key={index}
                className="group border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors"
                style={{ backgroundColor: openIndex === index ? 'rgba(255, 255, 255, 0.03)' : 'transparent' }}
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-accent font-bold mb-1 block">
                      {faq.category}
                    </span>
                    <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                      {faq.question}
                    </h3>
                  </div>
                  <span className={`text-2xl text-gray-500 transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`}>
                    ↓
                  </span>
                </button>
                <div 
                  className={`transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="p-6 pt-0 text-gray-400 leading-relaxed border-t border-white/5 mt-2">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500 italic">
              No matching FAQs found for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        {/* Support CTA */}
        <div className="mt-16 card gradient-border p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Still have questions?</h2>
          <p className="text-gray-400 mb-6">Can&apos;t find the answer you&apos;re looking for? Reach out to our team.</p>
          <div className="flex gap-4 justify-center">
            <a href="/support" className="btn-primary py-2 px-8">Get Support</a>
            <a href="/contact" className="btn-secondary py-2 px-8">Contact Sales</a>
          </div>
        </div>
      </div>
    </div>
  );
}
