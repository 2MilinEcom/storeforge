import { NextRequest, NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { repo } from "@/lib/repository";
import { exchangeCode, normalizeShop, verifyShopifyHmac } from "@/lib/shopify/oauth";

export async function GET(request: NextRequest) {
  try {
    const state = request.nextUrl.searchParams.get("state") || "";
    const cookieState = request.cookies.get("storeforge_shopify_state")?.value || "";
    if (!state || !cookieState || state !== cookieState) throw new Error("Invalid Shopify OAuth state");
    if (!verifyShopifyHmac(request.nextUrl)) throw new Error("Invalid Shopify OAuth HMAC");
    const shop = normalizeShop(request.nextUrl.searchParams.get("shop") || "");
    const code = request.nextUrl.searchParams.get("code") || "";
    const token = await exchangeCode(shop, code);
    await repo.upsertStore({ ownerId: "owner-local", shop, displayName: shop.replace(".myshopify.com", ""), encryptedAccessToken: encryptSecret(token.access_token), scopes: token.scope.split(",").map((x) => x.trim()) });
    const response = NextResponse.redirect(`${env.appUrl}/settings?shopify=connected`);
    response.cookies.delete("storeforge_shopify_state");
    return response;
  } catch (error) {
    return NextResponse.redirect(`${env.appUrl}/settings?shopify=error&message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
}
