import { promises as fs } from "node:fs";
import path from "node:path";
import { assertNoUserErrors, shopifyGraphql } from "@/lib/shopify/admin";
import { CREATE_FILES, FILE_STATUS, STAGE_UPLOADS } from "@/lib/shopify/operations";

export type StagedTarget = { url: string; resourceUrl: string; parameters: { name: string; value: string }[] };

export async function stageShopifyUpload(storeId: string, input: { resource: "VIDEO" | "IMAGE" | "FILE" | "SHOP_IMAGE"; filename: string; mimeType: string; fileSize?: string }) {
  const data = await shopifyGraphql<{ stagedUploadsCreate: { stagedTargets: StagedTarget[]; userErrors: { field?: string[]; message: string }[] } }>(storeId, STAGE_UPLOADS, { input: [input] });
  assertNoUserErrors(data.stagedUploadsCreate.userErrors);
  const target = data.stagedUploadsCreate.stagedTargets[0];
  if (!target) throw new Error("Shopify did not return a staged upload target");
  return target;
}

export async function uploadLocalFileToShopify(storeId: string, filePath: string, resource: "VIDEO" | "IMAGE" | "FILE" | "SHOP_IMAGE", mimeType: string) {
  const stat = await fs.stat(filePath);
  const target = await stageShopifyUpload(storeId, { resource, filename: path.basename(filePath), mimeType, fileSize: resource === "VIDEO" ? String(stat.size) : undefined });
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append("file", new Blob([await fs.readFile(filePath)], { type: mimeType }), path.basename(filePath));
  const upload = await fetch(target.url, { method: "POST", body: form });
  if (!upload.ok) throw new Error(`Shopify staged upload failed: ${upload.status}`);
  return target.resourceUrl;
}

export async function waitForShopifyFile(storeId: string, id: string, attempts = 30) {
  let last: any = null;
  for (let i = 0; i < attempts; i++) {
    const data = await shopifyGraphql<any>(storeId, FILE_STATUS, { id });
    last = data.node;
    if (last?.fileStatus === "READY" || last?.fileStatus === "FAILED") return last;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return last;
}

export async function createShopifyFile(storeId: string, originalSource: string, filename: string, contentType: "VIDEO" | "IMAGE", alt: string) {
  const data = await shopifyGraphql<any>(storeId, CREATE_FILES, { files: [{ originalSource, filename, contentType, alt, duplicateResolutionMode: "APPEND_UUID" }] });
  assertNoUserErrors(data.fileCreate.userErrors);
  const file = data.fileCreate.files?.[0];
  if (!file?.id) return file;
  return await waitForShopifyFile(storeId, file.id, contentType === "VIDEO" ? 30 : 15);
}
