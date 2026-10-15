import { z } from "zod";
import { env } from "@/lib/env";
import { openaiJson } from "@/lib/openai";
import { repo } from "@/lib/repository";
import type { ProductResearch, ReferenceAnalysis, ReferenceMemoryUse, ReferenceStore } from "@/lib/types";

const referenceAnalysisSchema = z.object({
  category: z.string().min(1),
  productTypes: z.array(z.string()).default([]),
  archetype: z.string().min(1),
  qualityScore: z.number().min(1).max(10),
  pageSequence: z.array(z.string()).default([]),
  hookPatterns: z.array(z.string()).default([]),
  offerPatterns: z.array(z.string()).default([]),
  proofPatterns: z.array(z.string()).default([]),
  objectionPatterns: z.array(z.string()).default([]),
  visualPatterns: z.array(z.string()).default([]),
  mobilePatterns: z.array(z.string()).default([]),
  ctaPatterns: z.array(z.string()).default([]),
  trustPatterns: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  transferableLessons: z.array(z.string()).default([]),
  distinctiveElementsToAvoidCopying: z.array(z.string()).default([]),
});

const discoverySchema = z.object({
  references: z.array(z.object({
    url: z.string().url(),
    title: z.string().min(1),
    category: z.string().default(""),
    reason: z.string().default(""),
  })).default([]),
});

function publicUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only public http/https store URLs are supported");
  const h = url.hostname.toLowerCase().replace(/^www\./, "");
  const blocked = h === "localhost" || h.endsWith(".local") || h === "0.0.0.0" || h === "::1" || h.startsWith("127.") || h.startsWith("10.") || h.startsWith("192.168.");
  const parts = h.split(".").map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) throw new Error("Private network URLs are not supported");
  if (blocked) throw new Error("Private or local URLs are not supported");
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
  return url;
}

function htmlTitle(html: string, fallback: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (match?.[1] || fallback).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

async function fetchReferencePage(value: string) {
  const url = publicUrl(value);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StoreForgeReferenceBrain/0.4; +https://localhost)" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { title: url.hostname, text: "" };
    const html = await response.text();
    const title = htmlTitle(html, url.hostname);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, " [H1] $1 ")
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, " [H2] $1 ")
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, " [H3] $1 ")
      .replace(/<button[^>]*>([\s\S]*?)<\/button>/gi, " [BUTTON] $1 ")
      .replace(/<summary[^>]*>([\s\S]*?)<\/summary>/gi, " [ACCORDION] $1 ")
      .replace(/<img[^>]*alt=["']([^"']+)["'][^>]*>/gi, " [IMAGE ALT] $1 ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 28000);
    return { title, text };
  } catch {
    return { title: url.hostname, text: "" };
  }
}

function fallbackAnalysis(categoryHint = "Ecommerce"): ReferenceAnalysis {
  return {
    category: categoryHint || "Ecommerce",
    productTypes: [],
    archetype: "Direct-response ecommerce product page",
    qualityScore: 5,
    pageSequence: ["Hero", "Benefits", "Product proof", "Objection handling", "FAQ", "Closing CTA"],
    hookPatterns: ["Lead with the clearest product outcome"],
    offerPatterns: ["Make price and primary purchase action easy to find"],
    proofPatterns: ["Show product use before making deeper claims"],
    objectionPatterns: ["Answer fit, use, and expectation questions before the closing CTA"],
    visualPatterns: ["Use product-specific visual proof rather than generic decoration"],
    mobilePatterns: ["Keep sections short and proof visible early"],
    ctaPatterns: ["Repeat the same primary action after major proof sections"],
    trustPatterns: ["Use only verifiable trust signals"],
    strengths: ["Reusable direct-response structure"],
    weaknesses: ["Page could not be fully analyzed automatically"],
    transferableLessons: ["Keep the conversion path simple and proof-led"],
    distinctiveElementsToAvoidCopying: ["Do not reproduce source wording, brand assets, photography, or distinctive page composition"],
  };
}

export async function analyzeReferenceUrl(url: string, categoryHint = "", notes = ""): Promise<{ title: string; domain: string; analysis: ReferenceAnalysis }> {
  const parsed = publicUrl(url);
  const page = await fetchReferencePage(parsed.toString());
  if (!env.openaiKey) return { title: page.title, domain: parsed.hostname, analysis: fallbackAnalysis(categoryHint) };

  const instruction = `Analyze this public ecommerce page as a CONVERSION PATTERN REFERENCE for a store-building system.
URL: ${parsed.toString()}
CATEGORY HINT: ${categoryHint || "None"}
MERCHANT NOTE: ${notes || "None"}
EXTRACTED PAGE TEXT: ${page.text || "Direct extraction was blocked. Use web search to understand the public page and be explicit about uncertainty."}

The goal is NOT to copy this store. Distill reusable principles: section sequence, information hierarchy, hook style, proof placement, offer presentation, objection handling, visual rhythm, mobile behavior, CTA repetition, trust design, and weaknesses. The extracted text contains structural markers such as [H1], [H2], [BUTTON], [ACCORDION], and [IMAGE ALT]; use those to infer page hierarchy. Do not invent visual details that are not observable from the available page evidence. Do not reproduce exact source sentences, brand assets, testimonial wording, proprietary graphics, or a distinctive layout. Do not claim the page has a proven conversion rate; qualityScore means visible conversion-design completeness only.

Return exactly: category (string), productTypes (string[]), archetype (string), qualityScore (number 1-10), pageSequence (string[]), hookPatterns (string[]), offerPatterns (string[]), proofPatterns (string[]), objectionPatterns (string[]), visualPatterns (string[]), mobilePatterns (string[]), ctaPatterns (string[]), trustPatterns (string[]), strengths (string[]), weaknesses (string[]), transferableLessons (string[]), distinctiveElementsToAvoidCopying (string[]).`;
  try {
    const raw = await openaiJson<unknown>(instruction, [], !page.text);
    return { title: page.title, domain: parsed.hostname, analysis: referenceAnalysisSchema.parse(raw) };
  } catch {
    return { title: page.title, domain: parsed.hostname, analysis: fallbackAnalysis(categoryHint) };
  }
}

export async function learnReference(input: { url: string; source?: "manual" | "discovered"; categoryHint?: string; notes?: string; reason?: string }) {
  const parsed = publicUrl(input.url);
  const current = await repo.getReferenceByUrl(parsed.toString());
  const learning = await repo.upsertReference({
    ownerId: "owner-local",
    url: parsed.toString(),
    domain: parsed.hostname,
    title: current?.title || parsed.hostname,
    source: current?.source === "manual" ? "manual" : (input.source || current?.source || "manual"),
    status: "learning",
    categoryHint: input.categoryHint || current?.categoryHint,
    notes: input.notes || current?.notes,
    reason: input.reason || current?.reason,
    analysis: current?.analysis,
    error: undefined,
    learnedAt: current?.learnedAt,
  });
  try {
    const learned = await analyzeReferenceUrl(parsed.toString(), input.categoryHint || current?.categoryHint || "", input.notes || current?.notes || "");
    return await repo.updateReference(learning.id, (r) => {
      r.title = learned.title || r.title;
      r.domain = learned.domain;
      r.analysis = learned.analysis;
      r.status = "ready";
      r.error = undefined;
      r.learnedAt = new Date().toISOString();
    });
  } catch (error) {
    return repo.updateReference(learning.id, (r) => {
      r.status = "failed";
      r.error = error instanceof Error ? error.message : String(error);
    });
  }
}

export async function discoverReferenceCandidates(query: string, limit = 5) {
  if (!env.openaiKey) throw new Error("OPENAI_API_KEY is required for automatic reference discovery");
  const safeLimit = Math.min(Math.max(limit, 1), 8);
  const raw = await openaiJson<unknown>(`Find ${safeLimit} public direct-to-consumer ecommerce PRODUCT PAGES that are useful structural references for: ${query}.
Use web search. Prefer standalone brand stores with a clear product detail page, strong mobile/direct-response information hierarchy, visual proof, objection handling, and repeated purchase moments. Exclude marketplaces such as Amazon, TikTok Shop, Etsy, Walmart, and eBay; exclude blogs, listicles, agencies, theme demos, and password-protected stores. Do not say these stores are proven high-converting unless public evidence exists. We are selecting them for visible conversion-oriented design patterns only.
Return exactly {"references":[{"url":"https://.../products/...","title":"...","category":"...","reason":"why its visible page structure is relevant"}]}.`, [], true);
  const parsed = discoverySchema.parse(raw);
  const unique = new Map<string, (typeof parsed.references)[number]>();
  for (const item of parsed.references) {
    try {
      const url = publicUrl(item.url).toString();
      if (!unique.has(url)) unique.set(url, { ...item, url });
    } catch {}
  }
  return [...unique.values()].slice(0, safeLimit);
}

function tokens(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((x) => x.length > 2));
}

function relevanceScore(reference: ReferenceStore, research: ProductResearch) {
  if (!reference.analysis || reference.status !== "ready") return -100;
  const query = tokens([research.productName, research.category, ...research.audience, ...research.features].join(" "));
  const doc = tokens([
    reference.analysis.category,
    reference.analysis.archetype,
    ...reference.analysis.productTypes,
    reference.categoryHint || "",
    reference.notes || "",
  ].join(" "));
  let overlap = 0;
  for (const token of query) if (doc.has(token)) overlap += 1;
  const researchCategory = research.category.toLowerCase();
  const referenceCategory = reference.analysis.category.toLowerCase();
  const categoryMatch = researchCategory.includes(referenceCategory) || referenceCategory.includes(researchCategory) ? 2.5 : 0;
  if (overlap === 0 && categoryMatch === 0) return 0;
  const manualBoost = reference.source === "manual" ? 1.25 : 0;
  const quality = reference.analysis.qualityScore / 10;
  return overlap * 1.4 + categoryMatch + manualBoost + quality;
}

export function referenceMemoryPrompt(references: ReferenceStore[]) {
  return references.map((reference) => ({
    url: reference.url,
    title: reference.title,
    source: reference.source,
    category: reference.analysis?.category,
    archetype: reference.analysis?.archetype,
    qualityScore: reference.analysis?.qualityScore,
    pageSequence: reference.analysis?.pageSequence,
    hookPatterns: reference.analysis?.hookPatterns,
    offerPatterns: reference.analysis?.offerPatterns,
    proofPatterns: reference.analysis?.proofPatterns,
    objectionPatterns: reference.analysis?.objectionPatterns,
    visualPatterns: reference.analysis?.visualPatterns,
    mobilePatterns: reference.analysis?.mobilePatterns,
    ctaPatterns: reference.analysis?.ctaPatterns,
    trustPatterns: reference.analysis?.trustPatterns,
    transferableLessons: reference.analysis?.transferableLessons,
    avoidCopying: reference.analysis?.distinctiveElementsToAvoidCopying,
  }));
}

export async function prepareReferenceMemory(research: ProductResearch, explicitReferenceUrl?: string): Promise<{ selected: ReferenceStore[]; use: ReferenceMemoryUse; autoDiscovered: number }> {
  const defaults = await repo.getBuildDefaults();
  if (!defaults.useReferenceBrain) {
    return { selected: [], autoDiscovered: 0, use: { category: research.category, selected: [], autoDiscovered: 0, usedAt: new Date().toISOString() } };
  }

  let explicitId = "";
  if (explicitReferenceUrl) {
    try {
      const explicit = await learnReference({ url: explicitReferenceUrl, source: "manual", categoryHint: research.category, notes: "Supplied as a project inspiration page" });
      explicitId = explicit.id;
    } catch {}
  }

  let ready = (await repo.listReferences()).filter((r) => r.status === "ready" && r.analysis);
  const desired = Math.min(Math.max(defaults.referenceCountPerBuild || 6, 2), 10);
  const relevantExisting = ready.sort((a, b) => relevanceScore(b, research) - relevanceScore(a, research)).filter((r) => relevanceScore(r, research) > 0.5);
  let autoDiscovered = 0;

  if (defaults.autoDiscoverReferences && env.openaiKey && relevantExisting.length < Math.min(3, desired)) {
    try {
      const candidates = await discoverReferenceCandidates(`${research.productName} — ${research.category}. Audience: ${research.audience.slice(0, 3).join(", ")}`, Math.min(4, desired - relevantExisting.length));
      for (const candidate of candidates) {
        const existing = await repo.getReferenceByUrl(candidate.url);
        if (existing?.status === "ready") continue;
        await learnReference({ url: candidate.url, source: "discovered", categoryHint: candidate.category || research.category, reason: candidate.reason });
        autoDiscovered += 1;
      }
      ready = (await repo.listReferences()).filter((r) => r.status === "ready" && r.analysis);
    } catch {}
  }

  const ranked = ready
    .map((reference) => ({ reference, score: relevanceScore(reference, research) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.reference);
  const explicit = explicitId ? ready.find((r) => r.id === explicitId) : undefined;
  const selected = [...(explicit ? [explicit] : []), ...ranked.filter((r) => r.id !== explicitId)].slice(0, desired);

  const use: ReferenceMemoryUse = {
    category: research.category,
    selected: selected.map((r) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      source: r.source,
      qualityScore: r.analysis?.qualityScore || 0,
      archetype: r.analysis?.archetype || "Ecommerce reference",
    })),
    autoDiscovered,
    usedAt: new Date().toISOString(),
  };
  return { selected, use, autoDiscovered };
}
