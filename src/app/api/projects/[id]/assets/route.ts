import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { projectDir, repo } from "@/lib/repository";
import type { AssetKind, AssetRef } from "@/lib/types";

function kindFor(file: File): AssetKind {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.name.toLowerCase().endsWith(".zip")) return "theme";
  throw new Error(`Unsupported file: ${file.name}`);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = await repo.getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const form = await request.formData();
  const files = form.getAll("files").filter((v): v is File => v instanceof File);
  if (!files.length) return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  const dir = await projectDir(id);
  const assetsDir = path.join(dir, "uploads");
  await fs.mkdir(assetsDir, { recursive: true });
  const assets: AssetRef[] = [];
  for (const file of files) {
    const kind = kindFor(file);
    const safeName = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
    const target = path.join(assetsDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(target, buffer);
    assets.push({ id: crypto.randomUUID(), kind, name: file.name, mimeType: file.type || "application/octet-stream", size: buffer.length, localPath: target, createdAt: new Date().toISOString(), sourceProvider: "upload", discovered: false, publishable: true });
  }
  const updated = await repo.updateProject(id, (p) => { p.assets.push(...assets); p.status = "ready"; });
  return NextResponse.json({ assets, project: updated });
}
