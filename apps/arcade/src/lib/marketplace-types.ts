/**
 * Reach Marketplace — Central type definitions
 */

export type SecurityStatus = 'passed' | 'warning' | 'concern' | 'failed';

export interface ReputationBreakdown {
  stability: number;
  grounding: number;
  compliance: number;
  efficiency: number;
}

export interface Author {
  id: string;
  name: string;
  verified: boolean;
  avatar: string;
}

export interface MarketplacePack {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  author: Author;
  organization: string | null;
  version: string;
  rating: number;
  downloads: number;
  trending: boolean;
  verified: boolean;
  securityStatus: SecurityStatus;
  reputationScore: number;
  reputationBreakdown: ReputationBreakdown;
  category: string;
  tags: string[];
  tools: string[];
  capabilities: string[];
  permissions: string[];
  dataHandling: 'minimal' | 'processed' | 'significant';
  lastUpdated: string;
  readme: string;
}

export interface PackVersion {
  version: string;
  changelog: string;
  releasedAt: string;
  downloads: number;
  reputationScore: number;
}

export interface BrowseFilters {
  search?: string;
  category?: string;
  sort?: 'relevance' | 'newest' | 'trending' | 'rating' | 'reputation';
  verifiedOnly?: boolean;
  trending?: boolean;
  tools?: string[];
  page?: number;
  limit?: number;
}

export interface PaginatedPacks {
  packs: MarketplacePack[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PackInstallResult {
  success: boolean;
  packId: string;
  version: string;
  installedAt: string;
  workflowId: string;
}

export interface PackPublishInput {
  name: string;
  version: string;
  description: string;
  category: string;
  tools: string[];
  tags: string[];
}

export interface PackReportInput {
  reason: 'security' | 'spam' | 'policy_violation' | 'malicious' | 'other';
  details: string;
}
