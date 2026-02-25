import { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_DOCS_BASE_URL ?? "https://reach-cli.com";
  const lastModified = new Date();

  const routes = [
    "",
    "/docs/install",
    "/docs/quickstart",
    "/docs/cli",
    "/docs/config",
    "/docs/examples",
    "/docs/presets",
    "/docs/plugins",
    "/docs/troubleshooting",
    "/docs/stability",
    "/docs/faq",
    "/support",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1.0 : 0.8,
  }));
}
