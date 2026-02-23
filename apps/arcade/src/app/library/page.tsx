"use client";

import { useState } from "react";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates";
import { ROUTES } from "@/lib/routes";

// Mock agent data for Marketplace tab
const mockAgents = [
  {
    id: "agent-1",
    name: "Customer Support Bot",
    description:
      "Intelligent customer service agent with multi-language support and sentiment analysis.",
    author: "ReadyLayer Team",
    version: "2.3.1",
    trustScore: 98,
    downloads: 15420,
    rating: 4.8,
    tags: ["Support", "NLP", "Multi-language"],
    verified: true,
    enterprise: true,
  },
  {
    id: "agent-2",
    name: "Data Pipeline Orchestrator",
    description:
      "Automated ETL workflows with error handling and retry logic for data pipelines.",
    author: "DataFlow Inc",
    version: "1.4.2",
    trustScore: 94,
    downloads: 8930,
    rating: 4.6,
    tags: ["ETL", "Data", "Automation"],
    verified: true,
    enterprise: false,
  },
  {
    id: "agent-3",
    name: "Code Review Assistant",
    description:
      "AI-powered code review with security scanning and best practice recommendations.",
    author: "DevTools Co",
    version: "3.0.0",
    trustScore: 96,
    downloads: 12300,
    rating: 4.7,
    tags: ["DevOps", "Security", "Code Quality"],
    verified: true,
    enterprise: true,
  },
  {
    id: "agent-4",
    name: "Analytics Aggregator",
    description:
      "Collect and aggregate analytics from multiple sources with real-time dashboards.",
    author: "Analytics Pro",
    version: "1.2.5",
    trustScore: 89,
    downloads: 5620,
    rating: 4.4,
    tags: ["Analytics", "Dashboard", "Real-time"],
    verified: false,
    enterprise: false,
  },
  {
    id: "agent-5",
    name: "Notification Router",
    description:
      "Smart notification routing with priority handling and channel optimization.",
    author: "ReadyLayer Team",
    version: "2.0.1",
    trustScore: 97,
    downloads: 22100,
    rating: 4.9,
    tags: ["Notifications", "Routing", "Messaging"],
    verified: true,
    enterprise: true,
  },
  {
    id: "agent-6",
    name: "Document Processor",
    description:
      "Extract data from documents with OCR, classification, and entity recognition.",
    author: "DocuMind AI",
    version: "1.8.3",
    trustScore: 92,
    downloads: 7840,
    rating: 4.5,
    tags: ["OCR", "Documents", "AI"],
    verified: true,
    enterprise: false,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  readiness: "Readiness",
  safety: "Safety",
  regression: "Change detection",
  tracing: "Tracing",
  release: "Release gates",
};

const DIFFICULTY_COLORS = {
  beginner: "text-emerald-400 bg-emerald-950/40",
  intermediate: "text-yellow-400 bg-yellow-950/40",
  advanced: "text-red-400 bg-red-950/40",
};

type Tab = "templates" | "marketplace";

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("templates");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredAgents = mockAgents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="section-container py-12">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Library</h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Pre-built agents and reliability templates to accelerate your builds.
        </p>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
        <div className="flex p-1 bg-surface border border-border rounded-xl">
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "templates"
                ? "bg-accent text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab("marketplace")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "marketplace"
                ? "bg-accent text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Marketplace
          </button>
        </div>

        <div className="w-full md:w-80 relative">
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-border text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all"
          />
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === "templates" ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="card hover:border-accent/50 transition-all flex flex-col group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-3xl grayscale group-hover:grayscale-0 transition-all">
                    {template.icon}
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${DIFFICULTY_COLORS[template.difficulty]}`}
                    >
                      {template.difficulty}
                    </span>
                  </div>
                </div>
                <h3 className="font-bold mb-1 text-lg">{template.name}</h3>
                <p className="text-sm text-gray-400 mb-6 flex-1 line-clamp-2">
                  {template.tagline}
                </p>
                <Link
                  href={`${ROUTES.PLAYGROUND}?template=${template.id}`}
                  className="btn-primary text-sm text-center w-full py-2.5"
                >
                  Use template
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="card flex flex-col group hover:border-accent/50 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-xl font-bold text-accent group-hover:scale-110 transition-transform">
                    {agent.name.charAt(0)}
                  </div>
                  {agent.enterprise && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      Enterprise
                    </span>
                  )}
                </div>
                <h3 className="font-bold mb-1 text-lg">{agent.name}</h3>
                <div className="text-xs text-gray-500 mb-3">
                  by {agent.author}
                </div>
                <p className="text-sm text-gray-400 mb-6 flex-1 line-clamp-2">
                  {agent.description}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/studio?agent=${agent.id}`}
                    className="flex-1 btn-primary text-center text-sm py-2.5"
                  >
                    Deploy
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty State */}
      {(activeTab === "templates" ? filteredTemplates : filteredAgents)
        .length === 0 && (
        <div className="py-20 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-xl font-bold mb-2">No results found</h3>
          <p className="text-gray-400">
            Try adjusting your search terms or filters.
          </p>
        </div>
      )}
    </div>
  );
}
