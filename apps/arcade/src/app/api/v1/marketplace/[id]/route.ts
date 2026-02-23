import { NextRequest, NextResponse } from "next/server";
import { getPackBySlug, getPack, listPackVersions } from "@/lib/cloud-db";
import { cloudErrorResponse } from "@/lib/cloud-auth";
import { logger } from "@/lib/logger";
import { formatPack } from "../route";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    // Try slug first, then ID
    const pack = getPackBySlug(id) ?? getPack(id);
    if (!pack) return cloudErrorResponse("Pack not found", 404);
    const versions = listPackVersions(pack.id);
    const latestVersion = versions[0];
    return NextResponse.json({
      pack: {
        ...formatPack(pack),
        readme: latestVersion?.readme ?? "",
        versions: versions.map((v) => ({
          version: v.version,
          changelog: v.changelog,
          published_at: v.published_at,
        })),
      },
    });
  } catch (err) {
    logger.error("Failed to get pack", err);
    return cloudErrorResponse("Failed to get pack", 500);
  }
}
