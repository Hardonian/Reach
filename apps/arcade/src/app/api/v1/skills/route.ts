import { NextRequest, NextResponse } from "next/server";
import { getAllSkills, getSkill, getToolsForSkill, skillToMCPConfig } from "@/lib/runtime";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const skill = getSkill(id);
    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    const tools = getToolsForSkill(id);
    const mcp = skillToMCPConfig(skill);
    return NextResponse.json({ skill, tools, mcpConfig: mcp });
  }

  return NextResponse.json({ skills: getAllSkills() });
}
