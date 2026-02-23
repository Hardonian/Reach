'use client';

import { isEnterpriseEnabled, type EnterpriseFeature } from '@/lib/enterprise';

/**
 * EnterpriseGuard Component
 * 
 * A wrapper component that conditionally renders content based on Enterprise feature flags.
 * Shows a placeholder message when the feature is not enabled (OSS mode).
 */
export function EnterpriseGuard({
  feature,
  children,
  fallback,
}: {
  feature: EnterpriseFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isEnabled = isEnterpriseEnabled(feature);

  if (!isEnabled) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className="enterprise-stub">
        <div className="enterprise-stub-badge">
          <span className="enterprise-badge-icon">🔒</span>
          <span className="enterprise-badge-text">Enterprise</span>
        </div>
        <p className="enterprise-stub-message">
          This feature is available in Reach Enterprise.
        </p>
        <p className="enterprise-stub-hint">
          Set NEXT_PUBLIC_ENTERPRISE_MODE=true to enable Enterprise features.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Enterprise only component - renders nothing in OSS mode
 */
export function EnterpriseOnly({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
