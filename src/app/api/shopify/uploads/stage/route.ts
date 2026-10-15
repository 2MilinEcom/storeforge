import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stageShopifyUpload } from "@/lib/shopify/uploads";

const schema = z.object({ storeId: z.string().min(1), resource: z.enum(["VIDEO", "IMAGE", "FILE", "SHOP_IMAGE"]), filename: z.string().min(1), mimeType: z.string().min(1), fileSize: z.string().optional() });

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json(await stageShopifyUpload(body.storeId, { resource: body.resource, filename: body.filename, mimeType: body.mimeType, fileSize: body.fileSize }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
}
