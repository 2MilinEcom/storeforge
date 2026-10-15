import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/repository";
import { defaultSteps } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2).max(120).optional(),
  productUrl: z.string().url(),
  referenceUrl: z.string().url().optional(),
  notes: z.string().max(5000).default(""),
  mediaSourceMode: z.enum(["auto", "uploads", "auto_plus_uploads"]).default("auto"),
  videoSearchTerms: z.array(z.string().min(1).max(160)).max(20).default([]),
  cost: z.number().nonnegative().optional(),
  sellingPrice: z.number().positive().optional(),
  compareAtPrice: z.number().positive().optional(),
  currency: z.string().length(3).default("USD"),
  storeId: z.string().optional(),
  baseThemeId: z.string().optional(),
});

export async function GET() {
  return NextResponse.json(await repo.listProjects());
}

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const defaults = await repo.getBuildDefaults();
    const inferredSelling = body.sellingPrice ?? (body.cost ? Number((body.cost * defaults.defaultMarkupMultiplier).toFixed(2)) : undefined);
    const inferredCompareAt = body.compareAtPrice;
    const project = await repo.createProject({
      ownerId: "owner-local",
      ...body,
      name: body.name?.trim() || "Auto product build",
      sellingPrice: inferredSelling,
      compareAtPrice: inferredCompareAt,
      currency: body.currency || defaults.defaultCurrency,
      status: "draft",
      assets: [],
      steps: defaultSteps(),
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
