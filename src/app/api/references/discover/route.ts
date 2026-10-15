import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { discoverReferenceCandidates, learnReference } from "@/lib/reference-brain";

const schema = z.object({
  query: z.string().min(2).max(300),
  limit: z.number().int().min(1).max(8).default(5),
});

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const candidates = await discoverReferenceCandidates(body.query, body.limit);
    const learned = [];
    for (const candidate of candidates) {
      learned.push(await learnReference({
        url: candidate.url,
        source: "discovered",
        categoryHint: candidate.category || body.query,
        reason: candidate.reason,
      }));
    }
    return NextResponse.json({ candidates, references: learned });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
