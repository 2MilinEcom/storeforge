import crypto from "node:crypto";
import { env } from "@/lib/env";

export function normalizeShop(input: string) {
  const value = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value)) throw new Error("Enter a valid *.myshopify.com domain");
  return value;
}

export function oauthUrl(shop: string, state: string) {
  const params = new URLSearchParams({
    client_id: env.shopifyKey,
    scope: env.shopifyScopes.join(","),
    redirect_uri: `${env.appUrl}/api/shopify/oauth/callback`,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyShopifyHmac(url: URL) {
  const hmac = url.searchParams.get("hmac") || "";
  const pairs = [...url.searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const digest = crypto.createHmac("sha256", env.shopifySecret).update(pairs).digest("hex");
  if (!hmac || hmac.length !== digest.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(digest));
}

export async function exchangeCode(shop: string, code: string) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env.shopifyKey, client_secret: env.shopifySecret, code }),
  });
  if (!response.ok) throw new Error(`Shopify OAuth token exchange failed (${response.status})`);
  return (await response.json()) as { access_token: string; scope: string };
}
