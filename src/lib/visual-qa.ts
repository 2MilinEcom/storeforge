import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { env } from "@/lib/env";
import { openaiJson } from "@/lib/openai";
import { projectDir } from "@/lib/repository";
import type { AssetRef, ConversionOpportunityPlan, MarketingStrategy, Project, VisualQaIssue, VisualQaReport } from "@/lib/types";

const execFileAsync = promisify(execFile);

const issueSchema = z.object({
  severity: z.enum(["critical", "major", "minor", "nit"]),
  page: z.enum(["home_desktop", "home_mobile", "product_desktop", "product_mobile", "global"]),
  category: z.enum(["broken", "hierarchy", "copy", "trust", "proof", "cta", "mobile", "media", "spacing", "accessibility", "performance", "consistency", "other"]),
  problem: z.string().min(1),
  evidence: z.string().min(1),
  suggestedFix: z.string().min(1),
  autoFixable: z.boolean(),
});

const reportSchema = z.object({
  score: z.number().min(0).max(100),
  satisfied: z.boolean(),
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  issues: z.array(issueSchema).default([]),
  nextActions: z.array(z.string()).default([]),
});

const patchSchema = z.object({
  strategy: z.object({
    heroKicker: z.string().optional(),
    heroHeading: z.string().optional(),
    heroSubheading: z.string().optional(),
    benefitBullets: z.array(z.string()).min(3).max(5).optional(),
    proofHeadline: z.string().optional(),
    storyHeadline: z.string().optional(),
    comparisonTitle: z.string().optional(),
    comparisonRows: z.array(z.object({ attribute: z.string(), product: z.string(), alternative: z.string() })).min(2).max(6).optional(),
    faq: z.array(z.object({ question: z.string(), answer: z.string() })).min(3).max(7).optional(),
    ctaLabel: z.string().optional(),
    mobilePriorities: z.array(z.string()).max(8).optional(),
  }).default({}),
  presentation: z.object({
    density: z.enum(["compact", "balanced", "spacious"]).optional(),
    heroScale: z.enum(["smaller", "default"]).optional(),
    mediaFit: z.enum(["cover", "contain"]).optional(),
    mobileVideoWidth: z.union([z.literal(72), z.literal(78), z.literal(84)]).optional(),
  }).default({}),
  modules: z.array(z.object({
    id: z.string(),
    status: z.enum(["include", "needs_input", "skip"]).optional(),
    priority: z.number().min(1).max(100).optional(),
    placement: z.enum(["after_ugc", "mid_page", "before_faq"]).optional(),
    kicker: z.string().optional(),
    heading: z.string().optional(),
    body: z.string().optional(),
    bullets: z.array(z.string()).max(6).optional(),
  })).default([]),
  rationale: z.array(z.string()).default([]),
});

function chromeCandidates() {
  return [
    env.chromePath,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean) as string[];
}

async function chromeExecutable() {
  for (const candidate of chromeCandidates()) {
    try { await fs.access(candidate); return candidate; } catch {}
  }
  throw new Error("StoreForge visual QA needs Google Chrome or Chromium. Set CHROME_PATH in .env.local if Chrome is installed in a custom location.");
}

function withPreviewTheme(base: string, pathname: string) {
  const preview = new URL(base);
  const themeId = preview.searchParams.get("preview_theme_id");
  const target = new URL(pathname, `${preview.protocol}//${preview.host}`);
  if (themeId) target.searchParams.set("preview_theme_id", themeId);
  return target.toString();
}

async function capture(executable: string, url: string, out: string, width: number, height: number) {
  await fs.mkdir(path.dirname(out), { recursive: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--ignore-certificate-errors",
    `--window-size=${width},${height}`,
    `--screenshot=${out}`,
    "--virtual-time-budget=6500",
    url,
  ];
  if (process.platform !== "darwin" && process.platform !== "win32") args.unshift("--no-sandbox");
  await execFileAsync(executable, args, { timeout: 45000, maxBuffer: 1024 * 1024 * 4 });
  await fs.access(out);
}

export async function captureStorefront(project: Project, pass: number) {
  if (!project.build?.previewUrl || !project.build?.productHandle) throw new Error("A Shopify preview URL and product handle are required for visual QA");
  const executable = await chromeExecutable();
  const dir = path.join(await projectDir(project.id), "visual-qa", `pass-${pass}`);
  const specs = [
    { key: "home_desktop", url: project.build.previewUrl, width: 1440, height: 5600 },
    { key: "home_mobile", url: project.build.previewUrl, width: 390, height: 5600 },
    { key: "product_desktop", url: withPreviewTheme(project.build.previewUrl, `/products/${project.build.productHandle}`), width: 1440, height: 6200 },
    { key: "product_mobile", url: withPreviewTheme(project.build.previewUrl, `/products/${project.build.productHandle}`), width: 390, height: 6200 },
  ] as const;
  const assets: AssetRef[] = [];
  const paths: { key: typeof specs[number]["key"]; path: string }[] = [];
  for (const spec of specs) {
    const output = path.join(dir, `${spec.key}.png`);
    await capture(executable, spec.url, output, spec.width, spec.height);
    const stat = await fs.stat(output);
    const asset: AssetRef = { id: crypto.randomUUID(), kind: "qa_screenshot", name: `qa-pass-${pass}-${spec.key}.png`, mimeType: "image/png", size: stat.size, localPath: output, createdAt: new Date().toISOString() };
    assets.push(asset);
    paths.push({ key: spec.key, path: output });
  }
  return { assets, paths };
}

export async function auditStorefront(project: Project, pass: number, paths: { key: string; path: string }[], targetScore: number): Promise<VisualQaReport> {
  if (!project.research || !project.strategy) throw new Error("Research and strategy are required for visual QA");
  const imagePaths = paths.map((x) => x.path);
  const raw = await openaiJson<unknown>(`You are the final visual QA director for a paid-social ecommerce store. Inspect four screenshots in this exact order: home desktop, home mobile, product desktop, product mobile.

PRODUCT:\n${JSON.stringify(project.research)}
STRATEGY:\n${JSON.stringify(project.strategy)}
CONVERSION OPPORTUNITY PLAN:\n${JSON.stringify(project.conversionPlan || null)}
KNOWN BUILD WARNINGS:\n${JSON.stringify(project.build?.warnings || [])}
TARGET SCORE: ${targetScore}
PASS: ${pass}

Evaluate what is actually visible, not what the code intended. Check for broken rendering, Shopify/password/error pages, missing media, awkward crops, text overflow, empty sections, duplicated sections, weak first viewport, poor CTA visibility, confusing price/variant hierarchy, insufficient proof, overly long copy, bad spacing, mobile thumb ergonomics, poor visual rhythm, trust gaps, inconsistent styling, unreadable contrast, and sections that add friction without adding decision value. Also check whether the page appears truthful and whether any visible claim looks unsupported by the supplied research.

A score is a visual/conversion-design QA score, not a claim about real conversion rate. satisfied should be true only if score >= ${targetScore}, there are no critical or major issues, the product page is usable on mobile, and no obvious broken/error/password screen is visible.

Return exactly: score (0-100), satisfied (boolean), summary (string), strengths (string[]), issues (array of {severity:critical|major|minor|nit,page:home_desktop|home_mobile|product_desktop|product_mobile|global,category:broken|hierarchy|copy|trust|proof|cta|mobile|media|spacing|accessibility|performance|consistency|other,problem,evidence,suggestedFix,autoFixable}), nextActions (string[]).`, imagePaths, false);
  const parsed = reportSchema.parse(raw);
  const hasSevere = parsed.issues.some((x) => x.severity === "critical" || x.severity === "major");
  return { ...parsed, satisfied: parsed.satisfied && parsed.score >= targetScore && !hasSevere, pass, createdAt: new Date().toISOString(), screenshotAssetIds: [] };
}

export async function refineFromVisualQa(project: Project, report: VisualQaReport): Promise<{ strategy: MarketingStrategy; conversionPlan?: ConversionOpportunityPlan; rationale: string[] }> {
  if (!project.strategy || !project.research) throw new Error("Strategy is required for visual QA refinement");
  const autoFixable = report.issues.filter((issue) => issue.autoFixable);
  if (!autoFixable.length) return { strategy: project.strategy, conversionPlan: project.conversionPlan, rationale: ["No safe automatic content/structure fixes were identified."] };
  const raw = await openaiJson<unknown>(`Create a SAFE refinement patch for this Shopify store based on the visual audit. You may improve hierarchy, shorten copy, strengthen CTA wording, reorder or remove StoreForge enhancement modules, clarify benefits, improve comparison language, and tighten FAQs. Do not invent new factual claims, reviews, shipping promises, guarantees, scarcity, discounts, before/after results, certifications, or medical outcomes. Do not change product price or variant facts.

PRODUCT RESEARCH:\n${JSON.stringify(project.research)}
CURRENT STRATEGY:\n${JSON.stringify(project.strategy)}
CURRENT CONVERSION PLAN:\n${JSON.stringify(project.conversionPlan || null)}
VISUAL AUDIT:\n${JSON.stringify(report)}
AUTO-FIXABLE ISSUES ONLY:\n${JSON.stringify(autoFixable)}

You can also make limited presentation corrections when the screenshots justify them: density=compact|balanced|spacious, heroScale=smaller|default, mediaFit=cover|contain, mobileVideoWidth=72|78|84. Use these for genuine spacing, oversized heading, crop, or mobile-card-width issues only.

Return exactly: strategy (object containing only fields that should change: heroKicker,heroHeading,heroSubheading,benefitBullets,proofHeadline,storyHeadline,comparisonTitle,comparisonRows,faq,ctaLabel,mobilePriorities), presentation (object containing only any of density,heroScale,mediaFit,mobileVideoWidth that should change), modules (array of module patches with id and any of status,priority,placement,kicker,heading,body,bullets), rationale (string[]).`, [], false);
  const patch = patchSchema.parse(raw);
  const presentation = {
    density: project.strategy.presentation?.density || "balanced",
    heroScale: project.strategy.presentation?.heroScale || "default",
    mediaFit: project.strategy.presentation?.mediaFit || "cover",
    mobileVideoWidth: project.strategy.presentation?.mobileVideoWidth || 78,
    ...patch.presentation,
  } as MarketingStrategy["presentation"];
  const nextStrategy: MarketingStrategy = { ...project.strategy, ...patch.strategy, presentation };
  let nextPlan = project.conversionPlan ? structuredClone(project.conversionPlan) : undefined;
  if (nextPlan) {
    for (const modulePatch of patch.modules) {
      const module = nextPlan.modules.find((x) => x.id === modulePatch.id);
      if (module) Object.assign(module, modulePatch);
    }
  }
  return { strategy: nextStrategy, conversionPlan: nextPlan, rationale: patch.rationale };
}

export function summarizeIssues(issues: VisualQaIssue[]) {
  const counts = { critical: 0, major: 0, minor: 0, nit: 0 };
  for (const issue of issues) counts[issue.severity] += 1;
  return counts;
}
