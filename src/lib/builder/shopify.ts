import type { Project } from "@/lib/types";
import { assertNoUserErrors, shopifyGraphql } from "@/lib/shopify/admin";
import { DUPLICATE_THEME, LIST_THEMES, PRODUCT_SET, PUBLICATIONS, PUBLISH_PRODUCT, THEME_FILES, THEME_STATUS, UPSERT_THEME_FILES } from "@/lib/shopify/operations";
import { buildStoreForgeThemeFiles } from "@/lib/builder/theme";
import { repo } from "@/lib/repository";

function stripThemeComments(text: string) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function patchShrineSettingsData(raw: string) {
  if (!raw) return undefined;
  try {
    const data = JSON.parse(stripThemeComments(raw));
    const current = data?.current;
    if (!current || typeof current !== "object") return undefined;
    if ("display_search" in current) current.display_search = false;
    if ("enable_cart_timer" in current) current.enable_cart_timer = false;
    if ("enable_cart_progress_bar" in current) current.enable_cart_progress_bar = false;
    if ("cart_progress_message" in current) current.cart_progress_message = "";
    if ("cart_progress_success_message" in current) current.cart_progress_success_message = "";
    const header = current.sections?.header?.settings;
    if (header && "display_search" in header) header.display_search = false;
    const footer = current.sections?.footer?.settings;
    if (footer) {
      if ("branding_text" in footer) footer.branding_text = "";
      if ("show_policy" in footer) footer.show_policy = true;
    }
    const drawerBlocks = current.sections?.["cart-drawer"]?.blocks;
    if (drawerBlocks && typeof drawerBlocks === "object") {
      for (const block of Object.values(drawerBlocks) as any[]) {
        if (["countdown_timer", "progress_bar", "checkpoints_bar"].includes(block?.type)) block.disabled = true;
      }
    }
    return JSON.stringify(data);
  } catch {
    return undefined;
  }
}

async function waitForThemeReady(storeId: string, themeId: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const data = await shopifyGraphql<any>(storeId, THEME_STATUS, { id: themeId });
    const theme = data.theme;
    if (theme?.processingFailed) throw new Error("Shopify failed to process the duplicated theme");
    if (theme && !theme.processing) return theme;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Shopify theme duplication is still processing. Try the build again in a moment.");
}

export async function listThemes(storeId: string) {
  const data = await shopifyGraphql<any>(storeId, LIST_THEMES);
  return data.themes.nodes as { id: string; name: string; role: string; prefix?: string; processing?: boolean; processingFailed?: boolean }[];
}

export function productSetInput(project: Project, imageUrls: string[]) {
  if (!project.research || !project.strategy) throw new Error("Project strategy is missing");
  const price = project.sellingPrice ?? project.research.sourcePrice ?? project.research.recommendedPrice ?? 29.99;
  const compareAt = project.compareAtPrice && project.compareAtPrice > price ? project.compareAtPrice : undefined;
  const variants = project.research.variants.filter((v) => v && v.toLowerCase() !== "default");
  const input: any = {
    title: project.research.productName || project.name,
    descriptionHtml: `<p><strong>${escapeHtml(project.strategy.heroHeading)}</strong></p><p>${escapeHtml(project.strategy.heroSubheading)}</p><ul>${project.strategy.benefitBullets.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`,
    productType: project.research.category,
    status: "ACTIVE",
    tags: ["StoreForge", project.research.category, ...project.strategy.safeClaims.slice(0, 4)].filter(Boolean).map((x) => String(x).slice(0, 255)),
    seo: { title: `${project.research.productName} | ${project.strategy.heroKicker}`, description: project.strategy.heroSubheading.slice(0, 300) },
  };
  if (imageUrls.length) input.files = imageUrls.map((url, index) => ({ originalSource: url, contentType: "IMAGE", alt: `${project.research!.productName} product image ${index + 1}`, filename: `storeforge-${project.id}-${index + 1}.png` }));
  if (variants.length) {
    const optionName = project.research.variantOptionName || "Option";
    input.productOptions = [{ name: optionName, position: 1, values: variants.map((name) => ({ name })) }];
    input.variants = variants.map((name) => ({ optionValues: [{ optionName, name }], price, compareAtPrice: compareAt }));
  } else {
    input.productOptions = [{ name: "Title", position: 1, values: [{ name: "Default Title" }] }];
    input.variants = [{ optionValues: [{ optionName: "Title", name: "Default Title" }], price, compareAtPrice: compareAt }];
  }
  return input;
}

async function publishProductToOnlineStore(storeId: string, productId: string) {
  const publications = await shopifyGraphql<any>(storeId, PUBLICATIONS);
  const onlineStore = (publications.publications?.nodes || []).find((node: any) =>
    String(node.catalog?.title || "").toLowerCase().includes("online store"),
  );
  if (!onlineStore?.id) return { published: false, warning: "Online Store publication was not found. Publish the product manually if needed." };
  const published = await shopifyGraphql<any>(storeId, PUBLISH_PRODUCT, { id: productId, input: [{ publicationId: onlineStore.id }] });
  const errors = published.publishablePublish?.userErrors || [];
  if (errors.length) return { published: false, warning: errors.map((x: any) => x.message).join("; ") };
  return { published: true as const };
}

export async function createOrUpdateProduct(project: Project, imageUrls: string[]) {
  if (!project.storeId) throw new Error("Choose a Shopify store first");
  const identifier = project.build?.productId ? { id: project.build.productId } : undefined;
  const data = await shopifyGraphql<any>(project.storeId, PRODUCT_SET, { input: productSetInput(project, imageUrls), identifier, synchronous: true });
  assertNoUserErrors(data.productSet.userErrors);
  if (!data.productSet.product) throw new Error("Shopify did not return a product");
  const product = data.productSet.product as { id: string; title: string; handle: string; templateSuffix: string };
  const defaults = await repo.getBuildDefaults();
  let publicationWarning: string | undefined;
  let publicationHeld = !defaults.publishProductDuringBuild;
  if (defaults.publishProductDuringBuild) {
    try {
      const result = await publishProductToOnlineStore(project.storeId, product.id);
      publicationWarning = result.warning;
      publicationHeld = false;
    } catch (error) {
      publicationWarning = `Product created, but StoreForge could not publish it to Online Store automatically: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return { ...product, publicationWarning, publicationHeld };
}

async function writeStoreForgeTheme(project: Project, themeId: string, videoUrls: string[], imageUrls: string[]) {
  if (!project.storeId || !project.research || !project.strategy) throw new Error("Store, research, and strategy are required");
  const read = await shopifyGraphql<any>(project.storeId, THEME_FILES, { id: themeId, filenames: ["templates/product.json", "config/settings_data.json"] });
  const raw = read.theme?.files?.edges?.find((e: any) => e.node.filename === "templates/product.json")?.node?.body?.content || "";
  const settingsRaw = read.theme?.files?.edges?.find((e: any) => e.node.filename === "config/settings_data.json")?.node?.body?.content || "";
  let productTemplate: any = { sections: { main: { type: "main-product", settings: {} } }, order: ["main"] };
  try { productTemplate = JSON.parse(stripThemeComments(raw)); } catch {}
  const defaults = await repo.getBuildDefaults();
  const operationalNote = [defaults.shippingPromise, defaults.returnPolicySummary].filter(Boolean).join(" · ");
  const price = project.sellingPrice ?? project.research.sourcePrice ?? project.research.recommendedPrice ?? 29.99;
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: project.currency || "USD" });
  const priceLabel = formatter.format(price);
  const validCompareAt = project.compareAtPrice && project.compareAtPrice > price ? project.compareAtPrice : undefined;
  const compareAtLabel = validCompareAt ? formatter.format(validCompareAt) : "";
  const saleBadge = validCompareAt ? `SAVE ${Math.max(1, Math.round((1 - price / validCompareAt) * 100))}%` : "";
  const files = buildStoreForgeThemeFiles({ productTemplate, research: project.research, strategy: project.strategy, videos: project.videos || [], videoUrls, imageUrls, priceLabel, compareAtLabel, saleBadge, productHandle: project.build?.productHandle, operationalNote, supportEmail: defaults.supportEmail, conversionPlan: project.conversionPlan });
  const patchedSettings = patchShrineSettingsData(settingsRaw);
  if (patchedSettings) files.push({ filename: "config/settings_data.json", body: { type: "TEXT", value: patchedSettings } });
  const write = await shopifyGraphql<any>(project.storeId, UPSERT_THEME_FILES, { themeId, files });
  assertNoUserErrors(write.themeFilesUpsert.userErrors);
}

export async function rebuildExistingTheme(project: Project, themeId: string, videoUrls: string[], imageUrls: string[]) {
  if (!project.storeId) throw new Error("Shopify store is required");
  const theme = await waitForThemeReady(project.storeId, themeId);
  await writeStoreForgeTheme(project, themeId, videoUrls, imageUrls);
  const store = await repo.getStore(project.storeId);
  const numeric = String(themeId).split("/").pop();
  const previewUrl = store ? `https://${store.shop}/?preview_theme_id=${numeric}` : undefined;
  return { themeId, themeName: theme?.name || project.build?.themeName || "StoreForge Build", previewUrl };
}

export async function duplicateAndBuildTheme(project: Project, videoUrls: string[], imageUrls: string[]) {
  if (!project.storeId || !project.baseThemeId || !project.research || !project.strategy) throw new Error("Store, base theme, research, and strategy are required");
  const duplicate = await shopifyGraphql<any>(project.storeId, DUPLICATE_THEME, { id: project.baseThemeId, name: `${project.research.productName} - StoreForge Build` });
  assertNoUserErrors(duplicate.themeDuplicate.userErrors);
  const theme = duplicate.themeDuplicate.newTheme;
  if (!theme?.id) throw new Error("Theme duplication failed");
  await waitForThemeReady(project.storeId, theme.id);
  await writeStoreForgeTheme(project, theme.id, videoUrls, imageUrls);
  const store = await repo.getStore(project.storeId);
  const numeric = String(theme.id).split("/").pop();
  const previewUrl = store ? `https://${store.shop}/?preview_theme_id=${numeric}` : undefined;
  return { themeId: theme.id, themeName: theme.name, previewUrl };
}
