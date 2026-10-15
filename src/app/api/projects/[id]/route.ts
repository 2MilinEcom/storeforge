import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repository";

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = await repo.getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  try {
    const project = await repo.updateProject(id, (p) => {
      if (typeof body.name === "string") p.name = body.name.slice(0, 120);
      if (typeof body.notes === "string") p.notes = body.notes.slice(0, 5000);
      if (typeof body.referenceUrl === "string" || body.referenceUrl === null) p.referenceUrl = body.referenceUrl || undefined;
      if (typeof body.storeId === "string" || body.storeId === null) p.storeId = body.storeId || undefined;
      if (typeof body.baseThemeId === "string" || body.baseThemeId === null) p.baseThemeId = body.baseThemeId || undefined;
      if (typeof body.sellingPrice === "number" || body.sellingPrice === null) p.sellingPrice = body.sellingPrice || undefined;
      if (typeof body.compareAtPrice === "number" || body.compareAtPrice === null) p.compareAtPrice = body.compareAtPrice || undefined;
      if (typeof body.cost === "number") p.cost = body.cost;
    });
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
