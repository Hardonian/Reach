/**
 * Marketplace API Integration
 * Backend API at /api/v1/marketplace
 */

import {
  BrowseFilters,
  MarketplacePack,
  PackVersion,
  PackInstallResult,
  PackPublishInput,
  PackReportInput,
  PaginatedPacks,
  ReputationBreakdown,
  SecurityStatus,
} from "./marketplace-types";

const API_BASE = "/api/v1/marketplace";

// Mock data for development
const MOCK_PACKS: MarketplacePack[] = [
  {
    id: "web-research-agent",
    name: "Web Research Agent",
    description:
      "Automated web research with intelligent citations and source verification. Extracts key insights from multiple sources and synthesizes comprehensive reports.",
    shortDescription: "Automated web research with citations",
    author: {
      id: "reach-team",
      name: "Reach Team",
      verified: true,
      avatar: "/avatars/reach-team.png",
    },
    organization: "Reach Cloud",
    version: "2.1.0",
    rating: 4.8,
    downloads: 15420,
    trending: true,
    verified: true,
    securityStatus: "passed",
    reputationScore: 98,
    reputationBreakdown: {
      stability: 99,
      grounding: 97,
      compliance: 98,
      efficiency: 96,
    },
    category: "research",
    tags: ["web", "research", "citations", "summarization"],
    tools: ["http.get", "browser.navigate", "search.query"],
    capabilities: ["web_browsing", "text_summarization"],
    permissions: ["network:external", "browser:read"],
    dataHandling: "minimal",
    lastUpdated: "2026-02-15",
    readme: `# Web Research Agent\n\nAutomated web research with intelligent citations.\n\n## Features\n- Multi-source research\n- Automatic citation generation\n- Source credibility scoring\n- PDF report export\n\n## Usage\nSimply provide a research topic and desired depth.`,
  },
  {
    id: "data-analysis-pack",
    name: "Data Analysis Pack",
    description:
      "Comprehensive CSV/Excel analysis with automated chart generation and statistical insights. Perfect for business intelligence and data exploration.",
    shortDescription: "CSV/Excel analysis with charts",
    author: {
      id: "dataflow-inc",
      name: "DataFlow Inc",
      verified: true,
      avatar: "/avatars/dataflow.png",
    },
    organization: "DataFlow",
    version: "3.2.1",
    rating: 4.6,
    downloads: 8930,
    trending: false,
    verified: true,
    securityStatus: "passed",
    reputationScore: 94,
    reputationBreakdown: {
      stability: 95,
      grounding: 93,
      compliance: 96,
      efficiency: 92,
    },
    category: "data",
    tags: ["csv", "excel", "charts", "analytics", "statistics"],
    tools: ["file.read", "data.process", "chart.generate"],
    capabilities: ["data_analysis", "visualization"],
    permissions: ["fs:read", "memory:high"],
    dataHandling: "processed",
    lastUpdated: "2026-02-10",
    readme: `# Data Analysis Pack\n\nAnalyze your data with AI-powered insights.`,
  },
  {
    id: "code-review-agent",
    name: "Code Review Agent",
    description:
      "Automated PR review with security scanning, best practice recommendations, and performance analysis. Supports 20+ programming languages.",
    shortDescription: "Automated PR review and security scanning",
    author: {
      id: "devtools-co",
      name: "DevTools Co",
      verified: true,
      avatar: "/avatars/devtools.png",
    },
    organization: "DevTools",
    version: "4.0.2",
    rating: 4.7,
    downloads: 12300,
    trending: true,
    verified: true,
    securityStatus: "passed",
    reputationScore: 96,
    reputationBreakdown: {
      stability: 97,
      grounding: 95,
      compliance: 98,
      efficiency: 94,
    },
    category: "development",
    tags: ["code-review", "security", "devops", "git"],
    tools: ["git.read", "code.analyze", "security.scan"],
    capabilities: ["code_analysis", "security_scanning"],
    permissions: ["git:read", "network:external"],
    dataHandling: "minimal",
    lastUpdated: "2026-02-18",
    readme: `# Code Review Agent\n\nAI-powered code review for modern development teams.`,
  },
  {
    id: "document-parser",
    name: "Document Parser",
    description:
      "Extract structured data from PDF, Word, and scanned documents with OCR and entity recognition. Handles tables, forms, and handwritten text.",
    shortDescription: "PDF/Word extraction with OCR",
    author: {
      id: "documind-ai",
      name: "DocuMind AI",
      verified: true,
      avatar: "/avatars/documind.png",
    },
    organization: "DocuMind",
    version: "1.8.5",
    rating: 4.5,
    downloads: 7840,
    trending: false,
    verified: true,
    securityStatus: "warning",
    reputationScore: 88,
    reputationBreakdown: {
      stability: 90,
      grounding: 87,
      compliance: 89,
      efficiency: 86,
    },
    category: "productivity",
    tags: ["pdf", "ocr", "documents", "extraction"],
    tools: ["file.read", "ocr.process", "entity.extract"],
    capabilities: ["document_processing", "ocr"],
    permissions: ["fs:read", "memory:high", "compute:intensive"],
    dataHandling: "processed",
    lastUpdated: "2026-01-28",
    readme: `# Document Parser\n\nExtract data from any document format.`,
  },
  {
    id: "email-assistant",
    name: "Email Assistant",
    description:
      "Draft professional emails and summarize long threads with context-aware suggestions. Integrates with Gmail, Outlook, and other providers.",
    shortDescription: "Draft and summarize emails",
    author: {
      id: "productivity-plus",
      name: "Productivity Plus",
      verified: false,
      avatar: "/avatars/productivity.png",
    },
    organization: null,
    version: "1.3.0",
    rating: 4.3,
    downloads: 5620,
    trending: false,
    verified: false,
    securityStatus: "passed",
    reputationScore: 82,
    reputationBreakdown: {
      stability: 85,
      grounding: 80,
      compliance: 84,
      efficiency: 79,
    },
    category: "productivity",
    tags: ["email", "communication", "summarization"],
    tools: ["email.read", "email.send", "text.generate"],
    capabilities: ["email_management", "text_generation"],
    permissions: ["email:read", "email:send"],
    dataHandling: "significant",
    lastUpdated: "2026-02-05",
    readme: `# Email Assistant\n\nSmart email management powered by AI.`,
  },
  {
    id: "social-media-manager",
    name: "Social Media Manager",
    description:
      "Schedule posts, analyze engagement, and generate content for multiple platforms. Supports Twitter, LinkedIn, Instagram, and more.",
    shortDescription: "Social media scheduling and analytics",
    author: {
      id: "social-pro",
      name: "Social Pro",
      verified: false,
      avatar: "/avatars/social.png",
    },
    organization: null,
    version: "2.0.1",
    rating: 4.1,
    downloads: 3210,
    trending: false,
    verified: false,
    securityStatus: "concern",
    reputationScore: 68,
    reputationBreakdown: {
      stability: 72,
      grounding: 65,
      compliance: 60,
      efficiency: 75,
    },
    category: "marketing",
    tags: ["social", "marketing", "analytics", "content"],
    tools: ["social.post", "analytics.read", "image.generate"],
    capabilities: ["social_media", "content_generation"],
    permissions: ["social:write", "network:external", "storage:write"],
    dataHandling: "significant",
    lastUpdated: "2026-01-15",
    readme: `# Social Media Manager\n\nAll-in-one social media management.`,
  },
];

const MOCK_VERSIONS: Record<string, PackVersion[]> = {
  "web-research-agent": [
    {
      version: "2.1.0",
      changelog: "Improved citation accuracy and added PDF export",
      releasedAt: "2026-02-15",
      downloads: 3200,
      reputationScore: 98,
    },
    {
      version: "2.0.0",
      changelog: "Major rewrite with better source verification",
      releasedAt: "2026-01-20",
      downloads: 8900,
      reputationScore: 96,
    },
    {
      version: "1.5.2",
      changelog: "Bug fixes and performance improvements",
      releasedAt: "2025-12-10",
      downloads: 3320,
      reputationScore: 94,
    },
  ],
  "data-analysis-pack": [
    {
      version: "3.2.1",
      changelog: "Fixed Excel parsing issues",
      releasedAt: "2026-02-10",
      downloads: 2100,
      reputationScore: 94,
    },
    {
      version: "3.2.0",
      changelog: "Added new chart types",
      releasedAt: "2026-01-25",
      downloads: 4300,
      reputationScore: 93,
    },
    {
      version: "3.1.0",
      changelog: "Statistical analysis improvements",
      releasedAt: "2025-12-15",
      downloads: 2530,
      reputationScore: 92,
    },
  ],
};

// API Functions

export async function browsePacks(filters: BrowseFilters = {}): Promise<PaginatedPacks> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  let filtered = [...MOCK_PACKS];

  // Apply search filter
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(
      (pack) =>
        pack.name.toLowerCase().includes(search) ||
        pack.description.toLowerCase().includes(search) ||
        pack.tags.some((tag: string) => tag.toLowerCase().includes(search)),
    );
  }

  // Apply category filter
  if (filters.category && filters.category !== "all") {
    filtered = filtered.filter((pack) => pack.category === filters.category);
  }

  // Apply tools filter
  if (filters.tools && filters.tools.length > 0) {
    filtered = filtered.filter((pack) =>
      filters.tools!.some((tool: string) => pack.tools.includes(tool)),
    );
  }

  // Apply verified only filter
  if (filters.verifiedOnly) {
    filtered = filtered.filter((pack) => pack.verified);
  }

  // Apply trending filter
  if (filters.trending) {
    filtered = filtered.filter((pack) => pack.trending);
  }

  // Apply sorting
  const sort = filters.sort || "relevance";
  filtered.sort((a, b) => {
    switch (sort) {
      case "newest":
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      case "trending":
        return b.downloads - a.downloads;
      case "rating":
        return b.rating - a.rating;
      case "reputation":
        return b.reputationScore - a.reputationScore;
      default:
        return b.reputationScore - a.reputationScore;
    }
  });

  const page = filters.page || 1;
  const limit = filters.limit || 12;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginated = filtered.slice(start, end);

  return {
    packs: paginated,
    total: filtered.length,
    page,
    limit,
    hasMore: end < filtered.length,
  };
}

export async function getPack(id: string): Promise<MarketplacePack | null> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return MOCK_PACKS.find((pack) => pack.id === id) || null;
}

export async function getPackVersions(id: string): Promise<PackVersion[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return (
    MOCK_VERSIONS[id] || [
      {
        version: "1.0.0",
        changelog: "Initial release",
        releasedAt: "2026-01-01",
        downloads: 100,
        reputationScore: 80,
      },
    ]
  );
}

export async function installPack(id: string, version?: string): Promise<PackInstallResult> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const pack = await getPack(id);
  if (!pack) {
    throw new Error("Pack not found");
  }

  return {
    success: true,
    packId: id,
    version: version || pack.version,
    installedAt: new Date().toISOString(),
    workflowId: `workflow-${Date.now()}`,
  };
}

export async function publishPack(metadata: PackPublishInput): Promise<{ id: string }> {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  return {
    id: `pack-${Date.now()}`,
  };
}

export async function reportPack(id: string, input: PackReportInput): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  // In production, this would send the report to the backend
  // console.log("Pack reported:", { id, ...input });
}

export async function validateManifest(manifest: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = JSON.parse(manifest);

    if (!parsed.name) errors.push("Missing required field: name");
    if (!parsed.version) errors.push("Missing required field: version");
    if (!parsed.description) warnings.push("Missing description");
    if (!parsed.tools || parsed.tools.length === 0) warnings.push("No tools declared");

    return { valid: errors.length === 0, errors, warnings };
  } catch {
    return { valid: false, errors: ["Invalid JSON format"], warnings: [] };
  }
}

// Categories
export const PACK_CATEGORIES = [
  { id: "all", label: "All", icon: "⊞" },
  { id: "research", label: "Research", icon: "🔍" },
  { id: "data", label: "Data", icon: "📊" },
  { id: "development", label: "Development", icon: "💻" },
  { id: "productivity", label: "Productivity", icon: "⚡" },
  { id: "marketing", label: "Marketing", icon: "📢" },
  { id: "security", label: "Security", icon: "🔒" },
  { id: "automation", label: "Automation", icon: "🤖" },
] as const;

// Available tools for filtering
export const AVAILABLE_TOOLS = [
  "http.get",
  "http.post",
  "file.read",
  "file.write",
  "console.log",
  "browser.navigate",
  "search.query",
  "git.read",
  "code.analyze",
  "security.scan",
  "ocr.process",
  "email.read",
  "email.send",
  "social.post",
  "analytics.read",
  "data.process",
  "chart.generate",
  "entity.extract",
  "text.generate",
  "image.generate",
] as const;
