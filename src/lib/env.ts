export const env = {
  appUrl: process.env.APP_URL || "http://localhost:3000",
  encryptionKey: process.env.APP_ENCRYPTION_KEY || "local-dev-storeforge-key-change-me-123456789",
  encryptionConfigured: Boolean(process.env.APP_ENCRYPTION_KEY && process.env.APP_ENCRYPTION_KEY.length >= 32),
  demoMode: (process.env.DEMO_MODE || "true").toLowerCase() === "true",
  openaiKey: process.env.OPENAI_API_KEY || "",
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
  openaiTranscribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-transcribe",
  chromePath: process.env.CHROME_PATH || "",
  ytDlpPath: process.env.YTDLP_PATH || "",
  autoDownloadYtDlp: (process.env.AUTO_DOWNLOAD_YTDLP || "true").toLowerCase() === "true",
  ytDlpCookiesFromBrowser: process.env.YTDLP_COOKIES_FROM_BROWSER || "",
  shopifyKey: process.env.SHOPIFY_API_KEY || "",
  shopifySecret: process.env.SHOPIFY_API_SECRET || "",
  shopifyVersion: process.env.SHOPIFY_API_VERSION || "2026-07",
  shopifyScopes: (process.env.SHOPIFY_SCOPES || "read_products,write_products,read_files,write_files,read_themes,write_themes,read_online_store_navigation,write_online_store_navigation,read_publications,write_publications").split(",").map((x) => x.trim()).filter(Boolean),
};

export function integrationStatus() {
  return {
    openai: Boolean(env.openaiKey),
    shopify: Boolean(env.shopifyKey && env.shopifySecret && env.encryptionConfigured),
    encryption: env.encryptionConfigured,
    demoMode: env.demoMode,
  };
}
