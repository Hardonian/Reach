'use client';

import { useState } from 'react';
import Link from 'next/link';

// Mock agent data
const mockAgents = [
  {
    id: 'agent-1',
    name: 'Customer Support Bot',
    description: 'Intelligent customer service agent with multi-language support and sentiment analysis.',
    author: 'ReadyLayer Team',
    version: '2.3.1',
    trustScore: 98,
    downloads: 15420,
    rating: 4.8,
    tags: ['Support', 'NLP', 'Multi-language'],
    verified: true,
    enterprise: true,
  },
  {
    id: 'agent-2',
    name: 'Data Pipeline Orchestrator',
    description: 'Automated ETL workflows with error handling and retry logic for data pipelines.',
    author: 'DataFlow Inc',
    version: '1.4.2',
    trustScore: 94,
    downloads: 8930,
    rating: 4.6,
    tags: ['ETL', 'Data', 'Automation'],
    verified: true,
    enterprise: false,
  },
  {
    id: 'agent-3',
    name: 'Code Review Assistant',
    description: 'AI-powered code review with security scanning and best practice recommendations.',
    author: 'DevTools Co',
    version: '3.0.0',
    trustScore: 96,
    downloads: 12300,
    rating: 4.7,
    tags: ['DevOps', 'Security', 'Code Quality'],
    verified: true,
    enterprise: true,
  },
  {
    id: 'agent-4',
    name: 'Analytics Aggregator',
    description: 'Collect and aggregate analytics from multiple sources with real-time dashboards.',
    author: 'Analytics Pro',
    version: '1.2.5',
    trustScore: 89,
    downloads: 5620,
    rating: 4.4,
    tags: ['Analytics', 'Dashboard', 'Real-time'],
    verified: false,
    enterprise: false,
  },
  {
    id: 'agent-5',
    name: 'Notification Router',
    description: 'Smart notification routing with priority handling and channel optimization.',
    author: 'ReadyLayer Team',
    version: '2.0.1',
    trustScore: 97,
    downloads: 22100,
    rating: 4.9,
    tags: ['Notifications', 'Routing', 'Messaging'],
    verified: true,
    enterprise: true,
  },
  {
    id: 'agent-6',
    name: 'Document Processor',
    description: 'Extract data from documents with OCR, classification, and entity recognition.',
    author: 'DocuMind AI',
    version: '1.8.3',
    trustScore: 92,
    downloads: 7840,
    rating: 4.5,
    tags: ['OCR', 'Documents', 'AI'],
    verified: true,
    enterprise: false,
  },
];

const categories = ['All', 'Support', 'Data', 'DevOps', 'Analytics', 'Security', 'Automation'];

function TrustBadge({ score, verified }: { score: number; verified: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {verified && (
        <span className="flex items-center gap-1 text-xs text-emerald-400" title="Verified Publisher">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Verified
        </span>
      )}
      <div className="flex items-center gap-1">
        <div className="w-16 h-1.5 bg-surface-hover rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              score >= 95 ? 'bg-emerald-500' : score >= 85 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">{score}</span>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAgents = mockAgents.filter((agent) => {
    const matchesCategory = selectedCategory === 'All' || agent.tags.some(t => t.toLowerCase() === selectedCategory.toLowerCase());
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="section-container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Agent Marketplace</h1>
        <p className="text-gray-400">Discover and deploy pre-built agents for your workflows</p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-white placeholder-gray-500 focus:outline-none focus:border-accent"
          />
          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-accent text-white'
                : 'bg-surface text-gray-400 hover:text-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => (
          <div key={agent.id} className="card flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-lg">
                  {agent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{agent.name}</h3>
                  <div className="text-sm text-gray-500">by {agent.author}</div>
                </div>
              </div>
              {agent.enterprise && (
                <span className="px-2 py-1 text-xs rounded-full bg-accent/20 text-accent">
                  Enterprise
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-400 text-sm mb-4 flex-1">{agent.description}</p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {agent.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 text-xs rounded-md bg-surface-hover text-gray-400">
                  {tag}
                </span>
              ))}
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm mb-4">
              <div className="flex items-center gap-1 text-gray-500">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                {agent.downloads.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {agent.rating}
              </div>
            </div>

            {/* Trust Score */}
            <div className="mb-4">
              <TrustBadge score={agent.trustScore} verified={agent.verified} />
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-auto">
              <Link
                href={`/studio?agent=${agent.id}`}
                className="flex-1 btn-primary text-center text-sm py-2"
              >
                Deploy
              </Link>
              <button className="px-4 py-2 rounded-lg border border-border text-sm text-gray-400 hover:text-white hover:border-accent transition-colors">
                Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
