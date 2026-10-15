import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { repo } from "@/lib/repository";

export async function GET(_: NextRequest, context: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await context.params;
  const project = await repo.getProject(projectId);
  const asset = project?.assets.find((a) => a.id === assetId);
  if (!asset?.localPath) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  try {
    const data = await fs.readFile(asset.localPath);
    return new NextResponse(data, { headers: { "Content-Type": asset.mimeType, "Content-Disposition": `inline; filename="${asset.name.replace(/"/g, "")}"`, "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "Asset file missing" }, { status: 404 });
  }
}
