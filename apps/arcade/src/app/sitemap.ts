import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://reach.dev";

  const routes = [
    "",
    "/docs",
    "/docs/getting-started",
    "/docs/quick-start",
    "/docs/installation",
    "/docs/architecture",
    "/docs/engine",
    "/docs/execution",
    "/docs/governance",
    "/docs/agents",
    "/docs/mcp",
    "/docs/deployment",
    "/docs/auth",
    "/docs/configuration",
    "/docs/security",
    "/docs/api",
    "/docs/cli",
    "/docs/integrations",
    "/docs/observability",
    "/docs/pipelines",
    "/docs/orchestration",
    "/docs/webhooks",
    "/enterprise",
    "/faq",
    "/pricing",
    "/support",
    "/marketplace",
    "/skills",
    "/tools",
    "/playground",
    "/templates",
    "/studio",
    "/dashboard",
    "/legal",
    "/legal/terms",
    "/legal/privacy",
    "/legal/cookies",
    "/security",
    "/transparency",
    "/responsible-disclosure",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}
