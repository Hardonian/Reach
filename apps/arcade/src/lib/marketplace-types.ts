/**
 * Marketplace type definitions used by marketplace-api.ts and UI components.
 */

export type SecurityStatus = 'passed' | 'warning' | 'concern' | 'failed' | 'pending';

export interface ReputationBreakdown {
  stability: number;
  grounding: number;
  compliance: number;
  efficiency: number;
}

export interface MarketplacePack {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  author: {
    id: string;
    name: string;
    verified: boolean;
    avatar?: string;
  };
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
  readme?: string;
}

export interface PackVersion {
  version: string;
  changelog: string;
  releasedAt: string;
  downloads: number;
  reputationScore: number;
}

export interface PackInstallResult {
  success: boolean;
  packId: string;
  version: string;
  installedAt: string;
  workflowId?: string;
}

export interface PackPublishInput {
  name: string;
  version: string;
  description: string;
  tools: string[];
  tags: string[];
  readme?: string;
}

export interface PackReportInput {
  reason: string;
  details?: string;
}

export interface BrowseFilters {
  search?: string;
  category?: string;
  tools?: string[];
  verifiedOnly?: boolean;
  trending?: boolean;
  sort?: 'relevance' | 'newest' | 'trending' | 'rating' | 'reputation';
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
