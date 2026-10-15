import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertNoUserErrors, shopifyGraphql } from "@/lib/shopify/admin";
import { CREATE_FILES, CREATE_THEME } from "@/lib/shopify/operations";
import { repo } from "@/lib/repository";
import { waitForShopifyFile } from "@/lib/shopify/uploads";

const schema = z.object({ storeId: z.string(), kind: z.enum(["video", "image", "theme"]), resourceUrl: z.string().url(), filename: z.string(), alt: z.string().optional(), projectId: z.string().optional(), assetId: z.string().optional(), themeName: z.string().optional() });

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    if (body.kind === "theme") {
      const data = await shopifyGraphql<any>(body.storeId, CREATE_THEME, { name: body.themeName || "StoreForge Master Theme", source: body.resourceUrl });
      assertNoUserErrors(data.themeCreate.userErrors);
      const theme = data.themeCreate.theme;
      await repo.saveThemeProfile({ ownerId: "owner-local", storeId: body.storeId, name: theme.name, shopifyThemeId: theme.id, notes: "Imported through StoreForge direct staged upload" });
      return NextResponse.json(theme);
    }
    const contentType = body.kind === "video" ? "VIDEO" : "IMAGE";
    const data = await shopifyGraphql<any>(body.storeId, CREATE_FILES, { files: [{ originalSource: body.resourceUrl, filename: body.filename, contentType, alt: body.alt || body.filename, duplicateResolutionMode: "APPEND_UUID" }] });
    assertNoUserErrors(data.fileCreate.userErrors);
    const file = data.fileCreate.files?.[0];
    if (body.projectId && body.assetId && file?.id) {
      await repo.updateProject(body.projectId, (p) => { const asset = p.assets.find((a) => a.id === body.assetId); if (asset) asset.shopifyFileId = file.id; });
    }
    const ready = file?.id ? await waitForShopifyFile(body.storeId, file.id, 8) : file;
    const shopifyUrl = ready?.originalSource?.url || ready?.sources?.find((x: any) => x.format === "mp4")?.url || ready?.image?.url || "";
    if (body.projectId && body.assetId && shopifyUrl) {
      await repo.updateProject(body.projectId, (p) => { const asset = p.assets.find((a) => a.id === body.assetId); if (asset) asset.shopifyUrl = shopifyUrl; });
    }
    return NextResponse.json({ ...ready, id: ready?.id || file?.id, shopifyUrl, ready: Boolean(shopifyUrl) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
}
