/** Local configuration only: never reads CLI credentials or authenticates. */
export function localShopifyConfig(source: NodeJS.ProcessEnv = process.env) {
  let loopback = false;
  try {
    const url = new URL(source.APP_URL || "http://localhost:3000");
    loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {}
  const local = loopback && !source.VERCEL && !source.RAILWAY_ENVIRONMENT && !source.CI;
  const shop = (source.SHOPIFY_CLI_STORE || "").trim().toLowerCase();
  const requested = source.SHOPIFY_AUTH_MODE || "auto";
  const mode = requested === "cli" || (requested === "auto" && local && shop) ? "cli" : "oauth";
  const validShop = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
  const error = !["auto", "cli", "oauth"].includes(requested) ? "SHOPIFY_AUTH_MODE must be auto, cli, or oauth."
    : mode === "cli" && !local ? "Shopify CLI mode requires a local loopback APP_URL and cannot run on hosted/CI environments."
    : mode === "cli" && !validShop ? "Set SHOPIFY_CLI_STORE to your development store's *.myshopify.com domain."
    : "";
  return { mode, shop, local, error, configured: mode === "cli" && !error,
    // Deliberate opt-in after reviewing operations; never enable this automatically.
    executionEnabled: source.SHOPIFY_CLI_EXECUTION_ENABLED === "true" };
}
