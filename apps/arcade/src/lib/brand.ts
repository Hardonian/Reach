/**
 * Brand configuration for Reach Arcade
 * Centralized brand constants to ensure consistency across the application
 */

// Primary brand name
export const BRAND_NAME = "Reach";

// Full product name
export const PRODUCT_NAME = "Reach Arcade";

// Tagline
export const TAGLINE = "Ship reliable AI agents";

// URLs
export const BRAND_URLS = {
  HOME: "https://reach.dev",
  DOCS: "https://reach-cli.com",
  GITHUB: "https://github.com/reach/reach",
  SUPPORT: "https://github.com/reach/reach/discussions",
  PRIVACY: "/privacy",
  TERMS: "/terms",
} as const;

// Social links
export const SOCIAL_LINKS = {
  TWITTER: "https://twitter.com/reachcli",
  GITHUB: "https://github.com/reach/reach",
  DISCORD: "https://discord.gg/reach",
} as const;

// Contact
export const CONTACT = {
  EMAIL: "support@reach.dev",
  SUPPORT: "https://github.com/reach/reach/issues",
} as const;

// Feature flags for brand-specific features
export const BRAND_FEATURES = {
  SHOW_OSS_BANNER: true,
  SHOW_PRICING: true,
  ENTERPRISE_ENABLED: process.env.REACH_CLOUD_ENABLED === "true",
} as const;
