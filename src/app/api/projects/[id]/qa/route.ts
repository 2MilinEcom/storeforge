import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repository";
import { startVisualQa } from "@/lib/builder/pipeline";

export async function POST(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!(await repo.getProject(id))) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const project = await repo.getProject(id);
  if (project?.status === "building") return NextResponse.json({ error: "StoreForge is already working on this project" }, { status: 409 });
  startVisualQa(id);
  return NextResponse.json({ ok: true, started: true });
}
