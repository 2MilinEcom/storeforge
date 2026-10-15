#!/usr/bin/env node
import { readFile, access } from "node:fs/promises";

const required = [
  "src/app/page.tsx",
  "src/app/new/page.tsx",
  "src/app/settings/page.tsx",
  "src/app/references/page.tsx",
  "src/app/api/references/route.ts",
  "src/app/api/references/discover/route.ts",
  "src/lib/reference-brain.ts",
  "src/lib/media-discovery.ts",
  "src/lib/conversion-intelligence.ts",
  "src/lib/visual-qa.ts",
  "src/app/api/projects/[id]/qa/route.ts",
  "src/lib/builder/pipeline.ts",
  "src/lib/builder/theme.ts",
  "src/lib/shopify/operations.ts",
  "src/lib/shopify/oauth.ts",
  "src/lib/repository.ts",
];

for (const file of required) await access(file);
JSON.parse(await readFile("package.json", "utf8"));
JSON.parse(await readFile("tsconfig.json", "utf8"));

const themeSource = await readFile("src/lib/builder/theme.ts", "utf8");
const schemaMatches = [...themeSource.matchAll(/\{% schema %\}([\s\S]*?)\{% endschema %\}/g)];
if (schemaMatches.length < 6) throw new Error(`Expected at least 6 generated Shopify section schemas, found ${schemaMatches.length}`);
for (const [index, match] of schemaMatches.entries()) {
  const schema = JSON.parse(match[1].trim());
  if (!schema.name) throw new Error(`Theme schema ${index + 1} has no name`);
}
const openStyles = (themeSource.match(/\{% stylesheet %\}/g) || []).length;
const closeStyles = (themeSource.match(/\{% endstylesheet %\}/g) || []).length;
if (openStyles !== closeStyles) throw new Error("Generated Liquid stylesheet tags are unbalanced");

const operations = await readFile("src/lib/shopify/operations.ts", "utf8");
for (const operation of ["PRODUCT_SET", "STAGE_UPLOADS", "CREATE_THEME", "DUPLICATE_THEME", "UPSERT_THEME_FILES", "PUBLISH_PRODUCT"]) {
  if (!operations.includes(`export const ${operation}`)) throw new Error(`Missing Shopify operation ${operation}`);
}

const referenceBrain = await readFile("src/lib/reference-brain.ts", "utf8");
for (const feature of ["learnReference", "discoverReferenceCandidates", "prepareReferenceMemory", "referenceMemoryPrompt"]) {
  if (!referenceBrain.includes(`function ${feature}`) && !referenceBrain.includes(`async function ${feature}`)) throw new Error(`Missing Reference Brain feature ${feature}`);
}

const mediaDiscovery = await readFile("src/lib/media-discovery.ts", "utf8");
for (const feature of ["discoverTikTokCandidates", "discoverTikTokVideos", "discoverProductReferences", "autoDiscoverProjectMedia", "externalTikTokAnalysis"]) {
  if (!mediaDiscovery.includes(`function ${feature}`) && !mediaDiscovery.includes(`async function ${feature}`)) throw new Error(`Missing automatic media sourcing feature ${feature}`);
}
if (!themeSource.includes("tiktok.com/player/")) throw new Error("Generated UGC section is missing TikTok Embed Player support");


const wizard = await readFile("src/components/NewBuildWizard.tsx", "utf8");
for (const marker of ["ONE-URL STORE BUILD", "Build store from URL", "Advanced overrides"]) {
  if (!wizard.includes(marker)) throw new Error(`Missing one-URL build marker: ${marker}`);
}
const research = await readFile("src/lib/research.ts", "utf8");
for (const marker of ["sourcePrice", "sourceCompareAtPrice", "sourceCurrency"]) {
  if (!research.includes(marker)) throw new Error(`Missing source autofill field: ${marker}`);
}

const optimizer = await readFile("src/lib/conversion-intelligence.ts", "utf8");
if (!optimizer.includes("discoverConversionOpportunities")) throw new Error("Missing conversion opportunity scanner");
const qa = await readFile("src/lib/visual-qa.ts", "utf8");
for (const feature of ["captureStorefront", "auditStorefront", "refineFromVisualQa"]) if (!qa.includes(`function ${feature}`) && !qa.includes(`async function ${feature}`)) throw new Error(`Missing visual QA feature ${feature}`);
console.log(`Source checks passed: ${required.length} core files, ${schemaMatches.length} Shopify section schemas, one-URL intake/autofill, Reference Brain, automatic TikTok/product-media sourcing, conversion opportunity scan, TikTok embed fallback, and visual QA loop present.`);
