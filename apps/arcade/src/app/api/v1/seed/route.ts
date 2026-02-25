/**
 * Dev-only seed endpoint.
 * POST /api/v1/seed
 * Creates a dev tenant + user + sample workflow + sample packs.
 * DISABLED in production.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  seedDevData,
  createPack,
  publishPackVersion,
} from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function POST(_req: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed endpoint disabled in production" }, { status: 403 });
  }
  if (process.env.REACH_CLOUD_ENABLED !== "true") {
    return NextResponse.json({ error: "REACH_CLOUD_ENABLED not set" }, { status: 503 });
  }

  try {
    const { tenant, user, rawApiKey } = seedDevData();

    // Seed sample marketplace packs
    const SAMPLE_PACKS = [
      {
        name: "Web Research Agent",
        slug: "web-research-agent",
        description: "Automated web research with intelligent citations and source verification.",
        shortDescription: "Automated web research with citations",
        category: "research" as const,
        visibility: "public" as const,
        tools: ["http.get", "browser.navigate", "search.query"],
        tags: ["web", "research", "citations"],
        permissions: ["network:external", "browser:read"],
        dataHandling: "minimal" as const,
        authorName: "ReadyLayer Team",
        version: "2.1.0",
        readme:
          "# Web Research Agent\n\nAutomated web research with intelligent citations.\n\n## Features\n- Multi-source research\n- Citation generation",
        changelog: "Initial release",
        reputationScore: 98,
        downloads: 15420,
      },
      {
        name: "Data Analysis Pack",
        slug: "data-analysis-pack",
        description: "Comprehensive CSV/Excel analysis with automated chart generation.",
        shortDescription: "CSV/Excel analysis with charts",
        category: "data" as const,
        visibility: "public" as const,
        tools: ["file.read", "data.process", "chart.generate"],
        tags: ["csv", "excel", "analytics"],
        permissions: ["fs:read", "memory:high"],
        dataHandling: "processed" as const,
        authorName: "DataFlow Inc",
        version: "3.2.1",
        readme: "# Data Analysis Pack\n\nAnalyze your data with AI-powered insights.",
        changelog: "Fixed Excel parsing",
        reputationScore: 94,
        downloads: 8930,
      },
      {
        name: "Code Review Agent",
        slug: "code-review-agent",
        description:
          "Automated PR review with security scanning and best practice recommendations.",
        shortDescription: "Automated PR review and security scanning",
        category: "development" as const,
        visibility: "public" as const,
        tools: ["git.read", "code.analyze", "security.scan"],
        tags: ["code-review", "security", "devops"],
        permissions: ["git:read", "network:external"],
        dataHandling: "minimal" as const,
        authorName: "DevTools Co",
        version: "4.0.2",
        readme: "# Code Review Agent\n\nAI-powered code review for modern development teams.",
        changelog: "Added multi-language support",
        reputationScore: 96,
        downloads: 12300,
      },
    ];

    for (const p of SAMPLE_PACKS) {
      try {
        const pack = createPack(tenant.id, user.id, p);
        publishPackVersion(
          pack.id,
          p.version,
          JSON.stringify({ name: p.name, version: p.version, tools: p.tools }),
          p.readme,
          p.changelog,
        );
        // Manually set reputation/downloads
        // @ts-ignore
        const { default: Database } = await import("better-sqlite3");
        const path = await import("path");
        const dbPath = process.env.CLOUD_DB_PATH ?? path.join(process.cwd(), "reach-cloud.db");
        const db = new Database(dbPath);
        db.prepare(
          "UPDATE packs SET reputation_score=?, downloads=?, security_status=?, verified=1 WHERE id=?",
        ).run(p.reputationScore, p.downloads, "passed", pack.id);
        db.close();
      } catch {
        /* already seeded */
      }
    }

    return NextResponse.json({
      ok: true,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      user: { id: user.id, email: user.email },
      api_key: rawApiKey === "ALREADY_SEEDED" ? "[already seeded - check existing key]" : rawApiKey,
      note:
        rawApiKey === "ALREADY_SEEDED"
          ? "Tenant already seeded."
          : "Dev seed created. Store your API key — shown only once.",
    });
  } catch (err) {
    console.error("[seed]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
