import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { normalizeShop, oauthUrl } from "@/lib/shopify/oauth";

export async function GET(request: NextRequest) {
  if (!env.shopifyKey || !env.shopifySecret || !env.encryptionConfigured) return NextResponse.json({ error: "SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and a 32+ character APP_ENCRYPTION_KEY are required" }, { status: 400 });
  try {
    const shop = normalizeShop(request.nextUrl.searchParams.get("shop") || "");
    const state = crypto.randomBytes(24).toString("hex");
    const response = NextResponse.redirect(oauthUrl(shop, state));
    response.cookies.set("storeforge_shopify_state", state, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", maxAge: 600, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
