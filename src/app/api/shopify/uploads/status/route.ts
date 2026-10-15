import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { waitForShopifyFile } from "@/lib/shopify/uploads";
import { repo } from "@/lib/repository";

const schema = z.object({
  storeId: z.string().min(1),
  fileId: z.string().min(1),
  projectId: z.string().optional(),
  assetId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const file = await waitForShopifyFile(body.storeId, body.fileId, 2);
    const shopifyUrl = file?.originalSource?.url || file?.sources?.find((x: any) => x.format === "mp4")?.url || file?.image?.url || "";
    if (body.projectId && body.assetId && shopifyUrl) {
      await repo.updateProject(body.projectId, (p) => {
        const asset = p.assets.find((a) => a.id === body.assetId);
        if (asset) { asset.shopifyFileId = body.fileId; asset.shopifyUrl = shopifyUrl; }
      });
    }
    return NextResponse.json({ id: body.fileId, fileStatus: file?.fileStatus, shopifyUrl, ready: Boolean(shopifyUrl) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
