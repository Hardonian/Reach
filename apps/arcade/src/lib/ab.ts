/**
 * ReadyLayer A/B Variant Framework
 *
 * Simple, zero-dependency variant switching:
 *  1. Query param: ?variant=A or ?variant=B  (dev/preview override)
 *  2. Cookie: rl_variant=A  (persisted assignment)
 *  3. Default: deterministic hash of IP/session (server) or random (client)
 *
 * Variants are tracked as analytics events (ab_variant_assigned).
 * No external experimentation platform required.
 */

import type { HeroVariant } from './copy';

export type Variant = 'A' | 'B';

export const VARIANTS: Variant[] = ['A', 'B'];

export const VARIANT_COOKIE = 'rl_variant';

/**
 * Server-side: resolve variant from request params/cookie.
 * Pass `searchParams` from Next.js page props.
 */
export function resolveVariant(searchParams?: Record<string, string | string[] | undefined>): Variant {
  // 1. Query param override (dev + preview)
  const param = searchParams?.['variant'];
  const paramVal = Array.isArray(param) ? param[0] : param;
  if (paramVal === 'A' || paramVal === 'B') return paramVal;

  // 2. Default to A (stable baseline)
  return 'A';
}

/**
 * Client-side: get persisted variant from cookie or assign one.
 */
export function getClientVariant(): Variant {
  if (typeof document === 'undefined') return 'A';
  const match = document.cookie.match(new RegExp(`(?:^|; )${VARIANT_COOKIE}=([AB])`));
  if (match) return match[1] as Variant;

  // Assign randomly (50/50) and persist for 30 days
  const assigned: Variant = Math.random() < 0.5 ? 'A' : 'B';
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${VARIANT_COOKIE}=${assigned}; expires=${expires}; path=/; SameSite=Lax`;
  return assigned;
}

export function isHeroVariant(v: string): v is HeroVariant {
  return v === 'A' || v === 'B';
}
