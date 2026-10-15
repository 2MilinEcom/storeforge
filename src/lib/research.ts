import { env } from "@/lib/env";
import { z } from "zod";
import { openaiJson } from "@/lib/openai";
import type { MarketingStrategy, ProductResearch, ReferenceStore, VideoAnalysis } from "@/lib/types";
import { referenceMemoryPrompt } from "@/lib/reference-brain";


const productResearchSchema = z.object({
  productName: z.string().min(1),
  category: z.string().min(1),
  summary: z.string().min(1),
  audience: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
  proofPoints: z.array(z.string()).default([]),
  claimsToAvoid: z.array(z.string()).default([]),
  variants: z.array(z.string()).default(["Default"]),
  variantOptionName: z.string().optional(),
  recommendedPrice: z.number().positive().nullable().optional(),
  sourcePrice: z.number().positive().nullable().optional(),
  sourceCompareAtPrice: z.number().positive().nullable().optional(),
  sourceCurrency: z.string().length(3).nullable().optional(),
  sourceNotes: z.array(z.string()).default([]),
});

const marketingStrategySchema = z.object({
  positioning: z.string(),
  heroKicker: z.string(),
  heroHeading: z.string(),
  heroSubheading: z.string(),
  benefitBullets: z.array(z.string()).min(3),
  proofHeadline: z.string(),
  storyHeadline: z.string(),
  comparisonTitle: z.string(),
  comparisonRows: z.array(z.object({ attribute: z.string(), product: z.string(), alternative: z.string() })).min(2),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).min(3),
  socialProof: z.array(z.object({ quote: z.string(), source: z.string() })).default([]),
  ctaLabel: z.string(),
  offerStrategy: z.string(),
  mobilePriorities: z.array(z.string()).default([]),
  imageShotList: z.array(z.object({ title: z.string(), prompt: z.string(), role: z.string() })).min(4),
  safeClaims: z.array(z.string()).default([]),
  bannedClaims: z.array(z.string()).default([]),
});

async function scrapePageText(url: string) {
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 StoreForge/1.0" }, redirect: "follow" });
    if (!response.ok) return "";
    const html = await response.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .slice(0, 24000);
  } catch { return ""; }
}

export async function researchProduct(productUrl: string, notes: string): Promise<ProductResearch> {
  const pageText = await scrapePageText(productUrl);
  if (env.openaiKey) {
    try {
      const raw = await openaiJson<unknown>(`Research this ecommerce product for a high-converting but truthful Shopify store.
Product URL: ${productUrl}
Merchant notes: ${notes || "None"}
Extracted page text: ${pageText || "Page blocked/unavailable; use web research and clearly distinguish uncertain facts."}
Use web search when useful. Do not invent medical, shipping, certification, review-count, or universal-performance claims.
Extract the actual current selling price shown by the source whenever it is verifiable. If the source visibly shows a legitimate original/list/compare-at price, extract that separately. Do not manufacture a compare-at price or infer one from a discount percentage.
Return JSON with exactly: productName, category, summary, audience (string[]), benefits (string[]), features (string[]), objections (string[]), proofPoints (string[]), claimsToAvoid (string[]), variants (string[]), variantOptionName (string such as Shade, Size, Color, Style, or Option), recommendedPrice (number or null), sourcePrice (number or null), sourceCompareAtPrice (number or null), sourceCurrency (3-letter currency code or null), sourceNotes (string[]).`, [], true);
      const parsed = productResearchSchema.parse(raw);
      return {
        ...parsed,
        recommendedPrice: parsed.recommendedPrice ?? undefined,
        sourcePrice: parsed.sourcePrice ?? undefined,
        sourceCompareAtPrice: parsed.sourceCompareAtPrice ?? undefined,
        sourceCurrency: parsed.sourceCurrency ?? undefined,
      };
    } catch {}
  }
  return {
    productName: "New product",
    category: "Consumer product",
    summary: notes || "Product imported from the supplied source URL.",
    audience: ["Problem-aware shoppers", "Social-commerce buyers"],
    benefits: ["Clear core benefit", "Simple usage", "Convenient format"],
    features: ["Product-specific feature set needs confirmation"],
    objections: ["Does it work?", "Is it right for me?", "How do I use it?"],
    proofPoints: ["Creator demonstrations"],
    claimsToAvoid: ["Unverified guarantees", "Invented reviews", "Invented shipping promises"],
    variants: ["Default"],
    variantOptionName: "Option",
    sourceNotes: ["Demo-mode research fallback used"],
  };
}

export async function synthesizeStrategy(research: ProductResearch, videos: VideoAnalysis[], referenceUrl?: string, commercialContext = "", referenceMemory: ReferenceStore[] = []): Promise<MarketingStrategy> {
  const referenceText = referenceUrl ? await scrapePageText(referenceUrl) : "";
  const memory = referenceMemoryPrompt(referenceMemory);
  if (env.openaiKey) {
    try {
      const raw = await openaiJson<unknown>(`Build the direct-response ecommerce strategy for a Shopify one-product store.
PRODUCT RESEARCH:\n${JSON.stringify(research)}
VIDEO ANALYSES:\n${JSON.stringify(videos)}
OPTIONAL REFERENCE PAGE: ${referenceUrl || "None"}
REFERENCE PAGE TEXT: ${referenceText || "Unavailable or not supplied"}
REFERENCE BRAIN MEMORY (distilled patterns from learned stores):\n${JSON.stringify(memory)}
COMMERCIAL CONTEXT: ${commercialContext || "No additional economics supplied"}
Use inspiration pages and Reference Brain memory for reusable conversion principles: information hierarchy, proof placement, pacing, offer presentation, objection handling, visual rhythm, and mobile behavior. Do not copy wording, brand assets, testimonials, proprietary graphics, or a distinctive creative composition from any source. Combine patterns from multiple references rather than cloning one store. Treat quality scores as visible design-completeness scores, not measured conversion-rate evidence.
The page should use: hook -> benefits -> visual proof -> objection handling -> comparison/education -> FAQ -> repeated CTA. Mobile/TikTok traffic is primary. Keep copy concise. Creator videos can support what is visibly demonstrated and can supply attributed quotes, but creator-spoken factual claims are not automatically verified. Product factual claims must be supported by the product research/source notes. Never turn a creator opinion into an objective claim.
Return JSON exactly with: positioning (string), heroKicker (string), heroHeading (string), heroSubheading (string), benefitBullets (string[] length 3-5), proofHeadline (string), storyHeadline (string), comparisonTitle (string), comparisonRows ({attribute,product,alternative}[] length 3-5), faq ({question,answer}[] length 4-6), socialProof ({quote,source}[]; only include quotes actually present in research/video transcript, otherwise []), ctaLabel (string), offerStrategy (string; recommend single-unit vs multi-unit/AOV approach based on the supplied economics, but never invent a discount), mobilePriorities (string[]), imageShotList ({title,prompt,role}[] length 6), safeClaims (string[]), bannedClaims (string[]).`);
      return marketingStrategySchema.parse(raw) as MarketingStrategy;
    } catch {}
  }
  return {
    positioning: research.summary,
    heroKicker: research.category.toUpperCase(),
    heroHeading: research.benefits[0] || research.productName,
    heroSubheading: `${research.benefits.slice(0, 3).join(". ")}.`,
    benefitBullets: research.benefits.slice(0, 4),
    proofHeadline: "See it in action before you buy.",
    storyHeadline: "Why shoppers understand it fast.",
    comparisonTitle: `${research.productName} vs. the usual routine`,
    comparisonRows: [
      { attribute: "Routine", product: "Designed as a simpler product-led routine", alternative: "May require additional steps or tools" },
      { attribute: "Proof", product: "Demonstrated in creator footage", alternative: "Varies by alternative" },
      { attribute: "Use", product: "Follow the verified product directions", alternative: "Varies by product" },
    ],
    faq: research.objections.slice(0, 5).map((q) => ({ question: q, answer: "Answer this with verified product information before publishing." })),
    socialProof: [],
    ctaLabel: "CHOOSE YOUR OPTION",
    offerStrategy: commercialContext ? `Use the supplied economics (${commercialContext}) as the constraint. Do not publish a bundle discount until a real discount is configured in Shopify.` : "Launch with the verified single-unit price. Add bundles only after a real discount and margin are configured.",
    mobilePriorities: ["Show proof early", "Keep CTA visible", "Use short vertical video", "Avoid long paragraphs"],
    imageShotList: [
      { title: "Hero", role: "Above fold", prompt: "Premium ecommerce hero image using the exact supplied product as reference." },
      { title: "In use", role: "Demonstration", prompt: "Authentic product-in-use image preserving exact packaging and geometry." },
      { title: "Detail", role: "Feature proof", prompt: "Macro product detail showing the key physical feature." },
      { title: "Lifestyle", role: "Aspiration", prompt: "Natural lifestyle scene with the exact product." },
      { title: "Scale", role: "Expectation setting", prompt: "Product held in hand for accurate scale." },
      { title: "Closing", role: "Final CTA", prompt: "Clean premium product still life for the closing CTA." },
    ],
    safeClaims: research.benefits,
    bannedClaims: research.claimsToAvoid,
  };
}
