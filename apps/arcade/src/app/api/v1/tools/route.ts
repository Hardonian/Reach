import { NextRequest, NextResponse } from "next/server";
import { getAllTools, getTool, getToolsByType } from "@/lib/runtime";
import type { ToolType } from "@/lib/runtime";

export const runtime = "nodejs";

const VALID_TYPES: ToolType[] = ["http", "github", "file", "webhook", "local-cli", "vector-db"];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") as ToolType | null;

  if (id) {
    const tool = getTool(id);
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }
    return NextResponse.json({ tool });
  }

  if (type && VALID_TYPES.includes(type)) {
    return NextResponse.json({ tools: getToolsByType(type) });
  }

  return NextResponse.json({ tools: getAllTools() });
}
