import { decryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { repo } from "@/lib/repository";

export type ShopifyGraphqlResponse<T> = { data?: T; errors?: { message: string }[] };

export async function shopifyGraphql<T>(storeId: string, query: string, variables: Record<string, unknown> = {}) {
  const store = await repo.getStore(storeId);
  if (!store) throw new Error("Shopify store is not connected");
  const token = decryptSecret(store.encryptedAccessToken);
  const response = await fetch(`https://${store.shop}/admin/api/${env.shopifyVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = (await response.json()) as ShopifyGraphqlResponse<T>;
  if (!response.ok) throw new Error(`Shopify HTTP ${response.status}: ${JSON.stringify(json)}`);
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new Error("Shopify returned no data");
  return json.data;
}

export function assertNoUserErrors(errors?: { field?: string[] | null; message: string }[]) {
  if (errors?.length) throw new Error(errors.map((e) => `${e.field?.join(".") || "Shopify"}: ${e.message}`).join("; "));
}
