import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/repository";

const schema = z.object({
  defaultCurrency: z.string().length(3).optional(),
  defaultMarkupMultiplier: z.number().min(1).max(20).optional(),
  defaultCompareAtMultiplier: z.number().min(1).max(10).optional(),
  enableBundleRecommendations: z.boolean().optional(),
  publishProductDuringBuild: z.boolean().optional(),
  shippingPromise: z.string().max(500).optional(),
  returnPolicySummary: z.string().max(1000).optional(),
  supportEmail: z.string().max(320).optional(),
  claimGuardrails: z.string().max(3000).optional(),
  useReferenceBrain: z.boolean().optional(),
  autoDiscoverReferences: z.boolean().optional(),
  referenceCountPerBuild: z.number().int().min(2).max(10).optional(),
  enableConversionOpportunityScan: z.boolean().optional(),
  enableVisualQa: z.boolean().optional(),
  autoApplyVisualQaFixes: z.boolean().optional(),
  visualQaTargetScore: z.number().int().min(70).max(99).optional(),
  visualQaMaxPasses: z.number().int().min(1).max(6).optional(),
  autoDiscoverTikTokVideos: z.boolean().optional(),
  autoTikTokVideoCount: z.number().int().min(1).max(10).optional(),
  autoDiscoverProductImages: z.boolean().optional(),
  autoProductImageCount: z.number().int().min(1).max(12).optional(),
  allowRehostDiscoveredVideos: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json(await repo.getBuildDefaults());
}

export async function PUT(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json(await repo.saveBuildDefaults(body));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
