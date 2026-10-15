import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/repository";
import { learnReference } from "@/lib/reference-brain";

const schema = z.object({
  urls: z.array(z.string().url()).min(1).max(30),
  categoryHint: z.string().max(120).optional(),
  notes: z.string().max(1500).optional(),
});

async function learnWithConcurrency(urls: string[], categoryHint?: string, notes?: string) {
  const queue = [...urls];
  const results: Awaited<ReturnType<typeof learnReference>>[] = [];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!url) break;
      results.push(await learnReference({ url, source: "manual", categoryHint, notes }));
    }
  });
  await Promise.all(workers);
  return results;
}

export async function GET() {
  return NextResponse.json(await repo.listReferences());
}

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const results = await learnWithConcurrency(body.urls, body.categoryHint, body.notes);
    return NextResponse.json({ references: results, count: results.length }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
