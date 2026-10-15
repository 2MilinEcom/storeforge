import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repository";
import { learnReference } from "@/lib/reference-brain";

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deleted = await repo.deleteReference(id);
  return deleted ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Reference not found" }, { status: 404 });
}

export async function POST(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const current = await repo.getReference(id);
    if (!current) return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    const learned = await learnReference({
      url: current.url,
      source: current.source,
      categoryHint: current.categoryHint,
      notes: current.notes,
      reason: current.reason,
    });
    return NextResponse.json(learned);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
