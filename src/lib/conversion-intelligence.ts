import { z } from "zod";
import { openaiJson } from "@/lib/openai";
import type { BuildDefaults, ConversionOpportunityPlan, MarketingStrategy, ProductResearch, ReferenceMemoryUse, VideoAnalysis } from "@/lib/types";

const moduleSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "mechanism",
    "how_to",
    "specs",
    "ingredients",
    "shade_size_fit",
    "whats_included",
    "use_cases",
    "compatibility",
    "care",
    "safety",
    "guarantee",
    "shipping_returns",
    "trust",
    "results_expectations",
    "before_after",
    "creator_gallery",
    "press_authority",
    "offer",
    "bundle",
    "subscription",
    "product_details",
    "other",
  ]),
  title: z.string().min(1),
  reason: z.string().min(1),
  priority: z.number().min(1).max(100),
  placement: z.enum(["after_ugc", "mid_page", "before_faq"]),
  status: z.enum(["include", "needs_input", "skip"]),
  evidenceState: z.enum(["supported", "merchant_input", "missing", "unsafe"]),
  impactPotential: z.number().min(1).max(10),
  confidence: z.number().min(0).max(1),
  kicker: z.string().default(""),
  heading: z.string().default(""),
  body: z.string().default(""),
  bullets: z.array(z.string()).max(6).default([]),
  sourceNotes: z.array(z.string()).default([]),
  merchantQuestion: z.string().default(""),
});

const planSchema = z.object({
  category: z.string().min(1),
  coverageScore: z.number().min(0).max(100),
  scannedSources: z.array(z.string()).default([]),
  evaluatedPatterns: z.array(z.string()).default([]),
  modules: z.array(moduleSchema).min(6).max(36),
  gaps: z.array(z.string()).default([]),
});

const baselinePatterns = [
  "above-the-fold clarity, product recognition, price, variant selector, and immediate CTA",
  "benefit bullets or decision-critical microcopy close to the buy box",
  "variant/shade/size/fit selection confidence and wrong-choice prevention",
  "real UGC or product-in-use proof near the first purchase decision",
  "mechanism or why-it-works education",
  "how-to-use / setup / application steps",
  "product specifications, dimensions, capacity, weight, or technical details where relevant",
  "ingredients, materials, formulation, construction, or technology where relevant",
  "what is included in the package and what is not included",
  "compatibility, prerequisites, use-case, environment, or device guidance",
  "care, cleaning, storage, maintenance, replacement, or longevity guidance",
  "safety, contraindications, expectation-setting, or limitation disclosures",
  "results expectations or timeline only when supportable",
  "before/after proof only when authentic, representative, and supportable",
  "product-vs-normal-alternative comparison using factual attributes",
  "source-backed rating/review summary and review themes",
  "customer questions / FAQ built around real objections rather than generic filler",
  "creator gallery, demonstrations, tutorials, or use-case video proof",
  "press, expert, certification, award, testing, or authority proof only when verified",
  "shipping cost/timing and returns only when merchant-supplied",
  "guarantee, warranty, trial, or risk reversal only when merchant-supplied",
  "payment methods, checkout security, and transactional trust reassurance",
  "availability / stock / preorder communication only when connected to real inventory truth",
  "legitimate offer framing and savings math",
  "bundle, quantity break, cross-sell, or AOV offer only when economics and discounts are real",
  "subscription/replenishment option only when repeat-use behavior genuinely fits",
  "giftability, gifting context, or packaging relevance where appropriate",
  "comparison chart, decision table, quiz, finder, calculator, or selector when the category benefits from decision support",
  "social/community proof such as creator breadth or customer usage patterns when source-backed",
  "sticky add-to-cart and persistent selected-variant context on mobile",
  "CTA repetition after major proof or objection-resolution moments",
  "final CTA and concise close",
  "mobile first-viewport hierarchy and thumb ergonomics",
  "mobile page rhythm, short text blocks, horizontal rails, and avoidance of wall-of-text sections",
  "image/video crop quality, captions, thumbnails, mute/autoplay behavior, and media redundancy",
  "page-speed and payload awareness: lazy loading, media count, and avoiding low-value heavy sections",
  "accessibility basics: contrast, readable type, tap targets, alt text, and semantic disclosure controls",
  "brand consistency, visual hierarchy, spacing, and section-to-section pacing",
  "post-purchase reassurance or support contact only when operationally real",
  "scarcity/countdowns/urgency only when objectively true; otherwise explicitly exclude them",
  "returns, guarantee, shipping, review, certification, and claims gaps that require merchant input before inclusion",
];

export async function discoverConversionOpportunities(args: {
  research: ProductResearch;
  strategy: MarketingStrategy;
  videos: VideoAnalysis[];
  defaults: BuildDefaults;
  referenceMemory?: ReferenceMemoryUse;
}): Promise<ConversionOpportunityPlan> {
  const { research, strategy, videos, defaults, referenceMemory } = args;
  const operationalTruths = {
    shippingPromise: defaults.shippingPromise || "not supplied",
    returnPolicySummary: defaults.returnPolicySummary || "not supplied",
    supportEmail: defaults.supportEmail || "not supplied",
    bundleRecommendationsAllowed: defaults.enableBundleRecommendations,
  };
  try {
    const raw = await openaiJson<unknown>(`Act as a senior direct-response ecommerce conversion architect. Build a comprehensive PRODUCT PAGE opportunity scan for this product.

PRODUCT RESEARCH:\n${JSON.stringify(research)}
CURRENT STRATEGY:\n${JSON.stringify(strategy)}
UGC/VIDEO PROOF:\n${JSON.stringify(videos)}
REFERENCE MEMORY USED:\n${JSON.stringify(referenceMemory || null)}
MERCHANT-SUPPLIED OPERATIONAL TRUTHS:\n${JSON.stringify(operationalTruths)}

Systematically evaluate every baseline conversion pattern below, then use web search to discover category-specific modules, objections, education patterns, decision aids, product-detail sections, and mobile PDP patterns that are common or useful for this product category. The goal is broad coverage, not blindly making the page longer.

BASELINE PATTERNS:\n${baselinePatterns.map((x, i) => `${i + 1}. ${x}`).join("\n")}

Rules:
- Do not claim a module is proven to increase conversion unless evidence is actually available.
- Do not invent reviews, shipping promises, guarantees, scarcity, countdowns, certifications, clinical outcomes, before/after results, or savings.
- If an idea needs merchant truth that is missing, mark status=needs_input and evidenceState=merchant_input instead of including it.
- If an idea would be misleading or unsafe, mark status=skip and evidenceState=unsafe.
- Avoid duplicating the existing UGC, comparison, social-proof, and FAQ sections unless there is a clearly different incremental purpose.
- Evaluate the full baseline taxonomy, but prefer roughly 8-18 useful INCLUDED modules over a bloated page. Other candidates can be needs_input or skip. Page speed and cognitive load are conversion concerns too.
- For included modules, write concise original copy based only on supported product facts. Never copy another store's wording.
- placement must be after_ugc, mid_page, or before_faq.

Return exactly: category (string), coverageScore (0-100 number representing how thoroughly the opportunity space was evaluated, not conversion performance), scannedSources (string[] of useful public URLs/domains or research notes), evaluatedPatterns (string[]), modules (array with id,type,title,reason,priority 1-100,placement,status,evidenceState,impactPotential 1-10,confidence 0-1,kicker,heading,body,bullets string[],sourceNotes string[],merchantQuestion), gaps (string[]).`, [], true);
    const parsed = planSchema.parse(raw);
    return { ...parsed, researchedAt: new Date().toISOString() };
  } catch {
    const fallback = [
      { id: "mechanism", type: "mechanism" as const, title: "Why it works", reason: "Explains the product mechanism after shoppers see proof.", priority: 92, placement: "mid_page" as const, status: "include" as const, evidenceState: "supported" as const, impactPotential: 8, confidence: .8, kicker: "WHY IT WORKS", heading: strategy.storyHeadline, body: strategy.positioning, bullets: research.features.slice(0, 4), sourceNotes: research.sourceNotes.slice(0, 3), merchantQuestion: "" },
      { id: "how_to", type: "how_to" as const, title: "How to use", reason: "Reduces uncertainty about first use.", priority: 88, placement: "after_ugc" as const, status: "include" as const, evidenceState: "supported" as const, impactPotential: 8, confidence: .76, kicker: "HOW TO USE", heading: "See how it fits into the routine.", body: "Follow the verified product directions and start with the simplest recommended use.", bullets: research.features.slice(0, 3), sourceNotes: research.sourceNotes.slice(0, 2), merchantQuestion: "" },
      { id: "details", type: "product_details" as const, title: "Product details", reason: "Sets accurate expectations before purchase.", priority: 76, placement: "mid_page" as const, status: "include" as const, evidenceState: "supported" as const, impactPotential: 6, confidence: .82, kicker: "PRODUCT DETAILS", heading: "Know exactly what you're ordering.", body: research.summary, bullets: research.features.slice(0, 5), sourceNotes: research.sourceNotes.slice(0, 3), merchantQuestion: "" },
      { id: "fit", type: "shade_size_fit" as const, title: "Choose the right option", reason: "Variant confidence matters when the product has multiple options.", priority: 84, placement: "after_ugc" as const, status: research.variants.length > 1 ? "include" as const : "skip" as const, evidenceState: research.variants.length > 1 ? "supported" as const : "missing" as const, impactPotential: 8, confidence: .78, kicker: "CHOOSE YOUR OPTION", heading: "Pick the option that best matches your needs.", body: "Use the product's verified variant guidance rather than assuming one option fits everyone.", bullets: research.variants.slice(0, 6), sourceNotes: research.sourceNotes.slice(0, 2), merchantQuestion: "" },
      { id: "shipping", type: "shipping_returns" as const, title: "Shipping & returns", reason: "Operational reassurance can reduce purchase anxiety.", priority: 70, placement: "before_faq" as const, status: defaults.shippingPromise || defaults.returnPolicySummary ? "include" as const : "needs_input" as const, evidenceState: defaults.shippingPromise || defaults.returnPolicySummary ? "supported" as const : "merchant_input" as const, impactPotential: 7, confidence: .8, kicker: "ORDER WITH CLARITY", heading: "Shipping and returns, without surprises.", body: [defaults.shippingPromise, defaults.returnPolicySummary].filter(Boolean).join(" "), bullets: [], sourceNotes: [], merchantQuestion: "Add your verified shipping and returns policy in StoreForge Settings." },
      { id: "guarantee", type: "guarantee" as const, title: "Guarantee", reason: "A real guarantee can reduce risk, but it must be merchant-supplied.", priority: 55, placement: "before_faq" as const, status: "needs_input" as const, evidenceState: "merchant_input" as const, impactPotential: 6, confidence: .66, kicker: "", heading: "", body: "", bullets: [], sourceNotes: [], merchantQuestion: "Add a guarantee only if you actually offer one." },
    ];
    return { category: research.category, coverageScore: 68, scannedSources: [], evaluatedPatterns: baselinePatterns, modules: fallback, gaps: ["Web-based category scan was unavailable, so StoreForge used the built-in conversion taxonomy."], researchedAt: new Date().toISOString() };
  }
}
