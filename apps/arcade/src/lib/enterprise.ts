/**
 * Reach Enterprise Configuration
 * 
 * This module provides feature flags and configuration for Enterprise features.
 * All Enterprise features are OFF by default and require explicit enablement.
 * 
 * OSS mode: All features work without auth, without external services, without secrets.
 */

// Enterprise feature flags - all OFF by default
export const ENTERPRISE_CONFIG = {
  // Core Enterprise features
  ENTERPRISE_MODE: process.env.NEXT_PUBLIC_ENTERPRISE_MODE === 'true',
  
  // SSO/SAML authentication (stubbed in OSS)
  SSO_ENABLED: process.env.NEXT_PUBLIC_SSO_ENABLED === 'true',
  
  // Multi-tenant workspaces (stubbed in OSS - only single workspace)
  MULTI_TENANT: process.env.NEXT_PUBLIC_MULTI_TENANT === 'true',
  
  // Cloud storage integration (stubbed - local only in OSS)
  CLOUD_STORAGE: process.env.NEXT_PUBLIC_CLOUD_STORAGE === 'true',
  
  // Managed policy packs (stubbed - local policies in OSS)
  MANAGED_POLICIES: process.env.NEXT_PUBLIC_MANAGED_POLICIES === 'true',
  
  // Audit log export (stubbed - local export in OSS)
  AUDIT_EXPORT: process.env.NEXT_PUBLIC_AUDIT_EXPORT === 'true',
  
  // Advanced analytics (stubbed - basic vitals in OSS)
  ADVANCED_ANALYTICS: process.env.NEXT_PUBLIC_ADVANCED_ANALYTICS === 'true',
  
  // Real-time collaboration (stubbed - single user in OSS)
  COLLABORATION: process.env.NEXT_PUBLIC_COLLABORATION === 'true',
  
  // Custom branding (stubbed - default branding in OSS)
  CUSTOM_BRANDING: process.env.NEXT_PUBLIC_CUSTOM_BRANDING === 'true',
  
  // API rate limiting (stubbed - no limits in OSS)
  API_RATE_LIMITING: process.env.NEXT_PUBLIC_API_RATE_LIMITING === 'true',
  
  // SLAs and compliance reporting (stubbed - basic status in OSS)
  COMPLIANCE_REPORTING: process.env.NEXT_PUBLIC_COMPLIANCE_REPORTING === 'true',
} as const;

// Type for checking if a feature is available
export type EnterpriseFeature = keyof typeof ENTERPRISE_CONFIG;

/**
 * Check if an Enterprise feature is enabled
 */
export function isEnterpriseEnabled(feature: EnterpriseFeature): boolean {
  return ENTERPRISE_CONFIG[feature];
}

/**
 * Check if any Enterprise features are enabled
 */
export function isEnterpriseMode(): boolean {
  return ENTERPRISE_CONFIG.ENTERPRISE_MODE;
}

/**
 * Get stub message for an Enterprise feature
 */
export function getEnterpriseStubMessage(feature: EnterpriseFeature): string {
  const messages: Record<EnterpriseFeature, string> = {
    ENTERPRISE_MODE: 'Enterprise mode is not enabled. This feature requires an Enterprise license.',
    SSO_ENABLED: 'SSO/SAML authentication is available in Enterprise. Configure your identity provider in the Enterprise dashboard.',
    MULTI_TENANT: 'Multi-tenant workspaces are available in Enterprise. Upgrade to manage multiple organizations.',
    CLOUD_STORAGE: 'Cloud storage integration is available in Enterprise. Connect your S3/GCS/Azure Blob storage.',
    MANAGED_POLICY: 'Managed policy packs are available in Enterprise. Access pre-built compliance policies.',
    AUDIT_EXPORT: 'Audit log export is available in Enterprise. Export to external SIEM systems.',
    ADVANCED_ANALYTICS: 'Advanced analytics are available in Enterprise. Get custom dashboards and reports.',
    COLLABORATION: 'Real-time collaboration is available in Enterprise. Enable team workspaces.',
    CUSTOM_BRANDING: 'Custom branding is available in Enterprise. Add your logo and themes.',
    API_RATE_LIMITING: 'API rate limiting is available in Enterprise. Configure API quotas.',
    COMPLIANCE_REPORTING: 'Compliance reporting is available in Enterprise. Generate audit-ready reports.',
  };
  
  return messages[feature] || 'This feature is available in Enterprise.';
}

/**
 * Enterprise feature guard component props
 */
export interface EnterpriseGuardProps {
  feature: EnterpriseFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Enterprise settings placeholder data
 * These are UI stubs for when Enterprise features are disabled
 */
export const ENTERPRISE_SETTINGS_STUBS = {
  sso: {
    status: 'disabled' as const,
    providers: [] as string[],
    message: 'SSO is available in Enterprise. Configure SAML 2.0 or OIDC providers.',
  },
  workspaces: {
    status: 'disabled' as const,
    workspaces: [],
    message: 'Multi-workspace support is available in Enterprise.',
  },
  policies: {
    status: 'disabled' as const,
    packs: [],
    message: 'Managed policy packs are available in Enterprise.',
  },
  audit: {
    status: 'disabled' as const,
    exports: [],
    message: 'Audit export is available in Enterprise.',
  },
  analytics: {
    status: 'disabled' as const,
    dashboards: [],
    message: 'Advanced analytics are available in Enterprise.',
  },
};
