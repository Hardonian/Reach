import { headers } from 'next/headers';

export type SiteMode = 'oss' | 'enterprise';

export interface SiteConfig {
  mode: SiteMode;
  domain: string;
  brand: string;
  title: string;
  description: string;
  nav: Array<{ href: string; label: string }>;
  footerLinks: Array<{ href: string; label: string }>;
}

const OSS_SITE: SiteConfig = {
  mode: 'oss',
  domain: 'reach-cli.com',
  brand: 'Reach CLI',
  title: 'Reach CLI — Deterministic Event Orchestration (OSS)',
  description: 'Open-source deterministic event orchestration: run, verify, and replay with evidence-first execution.',
  nav: [
    { href: '/', label: 'Home' },
    { href: '/docs', label: 'Docs' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/download', label: 'Download' },
    { href: '/security', label: 'Security' },
    { href: '/whitepaper', label: 'Whitepaper' },
    { href: '/roadmap', label: 'Roadmap' },
  ],
  footerLinks: [
    { href: 'https://github.com/reach-sh/reach', label: 'GitHub' },
    { href: '/legal/terms', label: 'License' },
    { href: '/docs', label: 'Contributing' },
    { href: '/responsible-disclosure', label: 'Security Policy' },
  ],
};

const ENTERPRISE_SITE: SiteConfig = {
  mode: 'enterprise',
  domain: 'ready-layer.com',
  brand: 'ReadyLayer',
  title: 'ReadyLayer — Enterprise Governance for Deterministic Agent Systems',
  description: 'Enterprise roadmap and beta information for governance controls built on the Reach OSS engine.',
  nav: [
    { href: '/', label: 'Home' },
    { href: '/enterprise', label: 'Enterprise' },
    { href: '/contact', label: 'Contact' },
    { href: 'https://reach-cli.com/docs', label: 'OSS Docs' },
  ],
  footerLinks: [
    { href: 'https://reach-cli.com', label: 'Reach OSS' },
    { href: '/enterprise', label: 'Roadmap/Beta Scope' },
    { href: '/contact', label: 'Contact' },
  ],
};

function resolveSiteByHost(host: string | null): SiteConfig {
  const normalized = (host ?? '').toLowerCase();
  if (normalized.includes('ready-layer.com')) {
    return ENTERPRISE_SITE;
  }
  return OSS_SITE;
}

function resolveSiteByMode(mode: string | undefined): SiteConfig {
  return mode === 'enterprise' ? ENTERPRISE_SITE : OSS_SITE;
}

export function getSiteConfigFromEnv(): SiteConfig {
  const mode = process.env.SITE_MODE ?? process.env.NEXT_PUBLIC_SITE_MODE;
  if (mode) return resolveSiteByMode(mode);
  return resolveSiteByHost(process.env.SITE_HOST_OVERRIDE ?? process.env.NEXT_PUBLIC_BASE_URL ?? null);
}

export function getSiteBaseUrl(site: SiteConfig): string {
  return `https://${site.domain}`;
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const envMode = process.env.SITE_MODE ?? process.env.NEXT_PUBLIC_SITE_MODE;
  if (envMode) return resolveSiteByMode(envMode);

  const h = await headers();
  const host = process.env.SITE_HOST_OVERRIDE ?? h.get('x-forwarded-host') ?? h.get('host');
  return resolveSiteByHost(host);
}
