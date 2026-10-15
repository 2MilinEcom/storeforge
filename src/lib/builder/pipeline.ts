import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { projectDir, repo } from "@/lib/repository";
import { researchProduct, synthesizeStrategy } from "@/lib/research";
import { prepareReferenceMemory } from "@/lib/reference-brain";
import { discoverConversionOpportunities } from "@/lib/conversion-intelligence";
import { auditStorefront, captureStorefront, refineFromVisualQa, summarizeIssues } from "@/lib/visual-qa";
import { analyzeVideo, createStoreClip } from "@/lib/video";
import { autoDiscoverProjectMedia, externalTikTokAnalysis } from "@/lib/media-discovery";
import { editProductImage, openaiJson } from "@/lib/openai";
import { createShopifyFile, uploadLocalFileToShopify } from "@/lib/shopify/uploads";
import { createOrUpdateProduct, duplicateAndBuildTheme, rebuildExistingTheme } from "@/lib/builder/shopify";
import type { AssetRef, BuildStepKey, Project, VideoAnalysis } from "@/lib/types";

const running = new Set<string>();

async function setStep(projectId: string, key: BuildStepKey, status: "waiting" | "running" | "done" | "blocked" | "failed", detail?: string) {
  return repo.updateProject(projectId, (p) => {
    const step = p.steps.find((s) => s.key === key);
    if (step) {
      step.status = status;
      step.detail = detail;
      if (status === "running") step.startedAt = new Date().toISOString();
      if (["done", "blocked", "failed"].includes(status)) step.finishedAt = new Date().toISOString();
    }
  });
}

async function current(id: string) {
  const p = await repo.getProject(id);
  if (!p) throw new Error("Project not found");
  return p;
}

async function generateCreative(project: Project) {
  const imageAssets = project.assets.filter((a) => a.kind === "image" && a.localPath);
  if (!imageAssets.length || !project.strategy) return [] as AssetRef[];
  const dir = await projectDir(project.id);
  const genDir = path.join(dir, "generated");
  await fs.mkdir(genDir, { recursive: true });
  const outputs: AssetRef[] = [];
  const existingGenerated = new Map<string, AssetRef>(project.assets.filter((asset) => asset.kind === "generated_image").map((asset) => [asset.name, asset] as [string, AssetRef]));
  if (!env.openaiKey) return outputs;
  for (const [index, shot] of project.strategy.imageShotList.slice(0, 4).entries()) {
    const target = path.join(genDir, `shot-${index + 1}.png`);
    const reference = imageAssets[index % imageAssets.length].localPath!;
    const prompt = `${shot.prompt}\nSTRICT PRODUCT PRESERVATION: Use the supplied image as the authoritative SKU. Preserve exact product geometry, proportions, materials, cap/applicator structure, color, logo placement and readable label design. Do not invent ingredients, awards, certifications, shade names or packaging features. Premium ecommerce photography, natural lighting, no unrelated text overlays.`;
    try {
      await editProductImage(reference, prompt, target);
      let fidelity = await openaiJson<{ accept: boolean; score: number; issues: string[] }>(`Compare the first image (authoritative product reference) with the second image (generated ecommerce creative). Judge only product identity fidelity: geometry, proportions, packaging, applicator/caps, materials, colors, logo/label placement, and any invented physical features. Ignore background, model, lighting, and composition. Return {"accept":boolean,"score":number from 0 to 1,"issues":string[]}. Accept only at score >= 0.86 with no major invented or missing product features.`, [reference, target]);
      if (!fidelity.accept || fidelity.score < 0.86) {
        const retryPrompt = `${prompt}\nCORRECTION FROM FIDELITY REVIEW: ${fidelity.issues.join("; ")}\nMatch the reference SKU more literally. If a detail is unclear, preserve the reference instead of inventing it.`;
        await editProductImage(reference, retryPrompt, target);
        fidelity = await openaiJson<{ accept: boolean; score: number; issues: string[] }>(`Compare the first image (authoritative product reference) with the second image (generated ecommerce creative). Return {"accept":boolean,"score":number from 0 to 1,"issues":string[]}. Accept only if the product itself is faithful enough for a shopper to recognize the exact SKU, with no major invented packaging or geometry.`, [reference, target]);
      }
      if (!fidelity.accept || fidelity.score < 0.82) { await fs.unlink(target).catch(() => {}); continue; }
      const stat = await fs.stat(target);
      const name = path.basename(target);
      const existing = existingGenerated.get(name);
      outputs.push({ id: existing?.id || crypto.randomUUID(), kind: "generated_image", name, mimeType: "image/png", size: stat.size, localPath: target, shopifyFileId: existing?.shopifyFileId, shopifyUrl: existing?.shopifyUrl, createdAt: existing?.createdAt || new Date().toISOString(), sourceProvider: "generated", discovered: false, publishable: true });
    } catch {}
  }
  return outputs;
}

function storefrontVideoUrls(project: Project, allowRehostDiscoveredVideos: boolean) {
  const hosted = project.assets.filter((asset) => (asset.kind === "clip" || asset.kind === "video") && asset.shopifyUrl).map((asset) => asset.shopifyUrl!).filter((url, index, all) => all.indexOf(url) === index);
  const embeds = (project.videos || []).filter((video) => {
    if (!video.embedUrl) return false;
    if (!allowRehostDiscoveredVideos) return true;
    const hostedForSource = project.assets.some((asset) => asset.sourceUrl === video.sourceUrl && Boolean(asset.shopifyUrl) && (asset.kind === "clip" || asset.kind === "video"));
    return !hostedForSource;
  }).map((video) => video.embedUrl!).filter((url, index, all) => all.indexOf(url) === index);
  return [...hosted, ...embeds].slice(0, 10);
}

function storefrontImageUrls(project: Project) {
  return project.assets.filter((asset) => (asset.kind === "generated_image" || asset.kind === "image") && asset.shopifyUrl).map((asset) => asset.shopifyUrl!).filter((url, index, all) => all.indexOf(url) === index).slice(0, 8);
}

async function uploadAssetsToShopify(project: Project) {
  if (!project.storeId) return { images: [] as string[], videos: [] as string[], warning: "No Shopify store selected" };
  const imageUrls: string[] = [];
  const videoUrls: string[] = [];
  let warning = "";
  const preferredImages = project.assets.filter((a) => (a.kind === "generated_image" || (a.kind === "image" && a.publishable !== false)) && a.localPath).slice(0, 8);
  for (const asset of preferredImages) {
    if (asset.shopifyUrl) { imageUrls.push(asset.shopifyUrl); continue; }
    try {
      const staged = await uploadLocalFileToShopify(project.storeId, asset.localPath!, "IMAGE", asset.mimeType || "image/png");
      const file = await createShopifyFile(project.storeId, staged, asset.name, "IMAGE", asset.name);
      const url = file?.image?.url;
      if (url) {
        imageUrls.push(url);
        await repo.updateProject(project.id, (p) => { const target = p.assets.find((x) => x.id === asset.id); if (target) { target.shopifyUrl = url; target.shopifyFileId = file?.id; } });
      }
    } catch (error) { warning ||= `Some images could not upload automatically: ${error instanceof Error ? error.message : String(error)}`; }
  }
  const clips = project.assets.filter((a) => a.kind === "clip" && a.localPath && a.publishable !== false);
  const videos = clips.length ? clips : project.assets.filter((a) => a.kind === "video" && a.localPath && a.publishable !== false);
  for (const asset of videos.slice(0, 10)) {
    if (asset.shopifyUrl) { videoUrls.push(asset.shopifyUrl); continue; }
    try {
      const staged = await uploadLocalFileToShopify(project.storeId, asset.localPath!, "VIDEO", asset.mimeType || "video/mp4");
      const file = await createShopifyFile(project.storeId, staged, asset.name, "VIDEO", asset.name);
      const url = file?.originalSource?.url || file?.sources?.find((s: any) => s.format === "mp4")?.url;
      if (url) {
        videoUrls.push(url);
        await repo.updateProject(project.id, (p) => { const target = p.assets.find((x) => x.id === asset.id); if (target) { target.shopifyUrl = url; target.shopifyFileId = file?.id; } });
      }
    } catch (error) { warning ||= `Some videos could not upload automatically. Use the browser-direct uploader in the project page. ${error instanceof Error ? error.message : String(error)}`; }
  }
  return { images: imageUrls, videos: videoUrls, warning };
}

async function runVisualQaLoop(projectId: string, imageUrls: string[], videoUrls: string[]) {
  const defaults = await repo.getBuildDefaults();
  if (!defaults.enableVisualQa) {
    await setStep(projectId, "qa", "done", "Visual QA disabled in Settings");
    return true;
  }
  let project = await current(projectId);
  if (!project.build?.themeId || !project.build?.previewUrl || !project.build?.productHandle) {
    await setStep(projectId, "qa", "blocked", "A Shopify theme preview and product handle are required for visual QA");
    await repo.updateProject(projectId, (p) => { p.build = p.build || {}; p.build.visualQa = { status: "blocked", targetScore: defaults.visualQaTargetScore, maxPasses: defaults.visualQaMaxPasses, passes: [], message: "Preview unavailable" }; });
    return false;
  }
  const target = Math.min(Math.max(defaults.visualQaTargetScore || 90, 70), 99);
  const maxPasses = Math.min(Math.max(defaults.visualQaMaxPasses || 4, 1), 6);
  await repo.updateProject(projectId, (p) => {
    p.build = p.build || {};
    p.build.visualQa = { status: "running", targetScore: target, maxPasses, passes: [], lastRunAt: new Date().toISOString() };
  });
  for (let pass = 1; pass <= maxPasses; pass++) {
    project = await current(projectId);
    await setStep(projectId, "qa", "running", `Visual inspection pass ${pass}/${maxPasses}: desktop + mobile homepage and PDP`);
    let captured;
    try {
      captured = await captureStorefront(project, pass);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await repo.updateProject(projectId, (p) => { p.build = p.build || {}; p.build.visualQa = { ...(p.build.visualQa || { targetScore: target, maxPasses, passes: [] }), status: "blocked", message, lastRunAt: new Date().toISOString() }; });
      await setStep(projectId, "qa", "blocked", message);
      return false;
    }
    await repo.updateProject(projectId, (p) => { p.assets.push(...captured.assets); });
    project = await current(projectId);
    const report = await auditStorefront(project, pass, captured.paths, target);
    report.screenshotAssetIds = captured.assets.map((asset) => asset.id);
    const counts = summarizeIssues(report.issues);
    await repo.updateProject(projectId, (p) => {
      p.build = p.build || {};
      const visualQa = p.build.visualQa || { status: "running" as const, targetScore: target, maxPasses, passes: [] };
      visualQa.passes = [...visualQa.passes, report];
      visualQa.finalScore = report.score;
      visualQa.lastRunAt = new Date().toISOString();
      visualQa.message = report.summary;
      visualQa.status = report.satisfied ? "satisfied" : "running";
      p.build.visualQa = visualQa;
    });
    if (report.satisfied) {
      await setStep(projectId, "qa", "done", `Visual QA satisfied at ${report.score}/100 after ${pass} pass${pass === 1 ? "" : "es"}`);
      return true;
    }
    const autoFixable = report.issues.filter((issue) => issue.autoFixable);
    if (!defaults.autoApplyVisualQaFixes || pass >= maxPasses || autoFixable.length === 0) {
      await repo.updateProject(projectId, (p) => { if (p.build?.visualQa) p.build.visualQa.status = "needs_review"; });
      await setStep(projectId, "qa", "blocked", `Visual QA ${report.score}/100 · ${counts.critical} critical · ${counts.major} major · manual review needed`);
      return false;
    }
    const refined = await refineFromVisualQa(project, report);
    await repo.updateProject(projectId, (p) => { p.strategy = refined.strategy; if (refined.conversionPlan) p.conversionPlan = refined.conversionPlan; });
    project = await current(projectId);
    await rebuildExistingTheme(project, project.build!.themeId!, videoUrls, imageUrls);
    await new Promise((resolve) => setTimeout(resolve, 1800));
  }
  await repo.updateProject(projectId, (p) => { if (p.build?.visualQa) p.build.visualQa.status = "needs_review"; });
  await setStep(projectId, "qa", "blocked", "Visual QA hit the maximum refinement passes without reaching the satisfaction threshold");
  return false;
}

export async function runVisualQaOnly(projectId: string) {
  if (running.has(projectId)) throw new Error("StoreForge is already working on this project");
  running.add(projectId);
  try {
    const project = await current(projectId);
    if (project.status === "building") throw new Error("Wait for the current build to finish before running visual QA again");
    const defaults = await repo.getBuildDefaults();
    const imageUrls = storefrontImageUrls(project);
    const videoUrls = storefrontVideoUrls(project, defaults.allowRehostDiscoveredVideos);
    await repo.updateProject(projectId, (p) => { p.status = "building"; });
    const ok = await runVisualQaLoop(projectId, imageUrls, videoUrls);
    await repo.updateProject(projectId, (p) => { p.status = ok ? "complete" : "blocked"; });
    return ok;
  } finally {
    running.delete(projectId);
  }
}

export function startVisualQa(projectId: string) {
  void runVisualQaOnly(projectId).catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    await repo.updateProject(projectId, (p) => { p.status = "blocked"; p.build = p.build || {}; p.build.warnings = [...(p.build.warnings || []), message]; }).catch(() => {});
  });
}

export async function runBuild(projectId: string) {
  if (running.has(projectId)) return;
  running.add(projectId);
  try {
    await repo.updateProject(projectId, (p) => { p.status = "building"; p.build = p.build || {}; p.build.warnings = []; });
    await setStep(projectId, "ingest", "running", "Validating product URL and optional uploaded assets");
    let project = await current(projectId);
    if (!project.productUrl) throw new Error("Add a product or TikTok Shop URL");
    const uploadedVideos = project.assets.filter((a) => a.kind === "video" && !a.discovered).length;
    const uploadedImages = project.assets.filter((a) => a.kind === "image" && !a.discovered).length;
    await setStep(projectId, "ingest", "done", `${project.mediaSourceMode || "auto"} sourcing · ${uploadedVideos} uploaded video(s) · ${uploadedImages} uploaded product reference(s)`);

    await setStep(projectId, "research", "running", "Researching product, objections, variants, and safe claims");
    const defaults = await repo.getBuildDefaults();
    const researchContext = [project.notes, defaults.claimGuardrails ? `Permanent merchant guardrails: ${defaults.claimGuardrails}` : ""].filter(Boolean).join("\n");
    const research = await researchProduct(project.productUrl, researchContext);
    await repo.updateProject(projectId, (p) => {
      p.research = research;
      if (!p.name || p.name === "Auto product build" || p.name === "New product build") p.name = research.productName;
      if (!p.sellingPrice) p.sellingPrice = research.sourcePrice ?? research.recommendedPrice;
      if (!p.compareAtPrice && research.sourceCompareAtPrice && research.sourceCompareAtPrice > (p.sellingPrice ?? 0)) p.compareAtPrice = research.sourceCompareAtPrice;
      if (research.sourceCurrency && /^[A-Z]{3}$/.test(research.sourceCurrency)) p.currency = research.sourceCurrency;
    });
    await setStep(projectId, "research", "done", `${research.productName}${research.sourcePrice ? ` · source price ${research.sourceCurrency || project.currency} ${research.sourcePrice}` : ""}`);

    await setStep(projectId, "media_discovery", "running", "Finding public TikTok creator posts and exact-SKU product references from the URL + search terms");
    project = await current(projectId);
    if ((project.mediaSourceMode || "auto") === "uploads") {
      await setStep(projectId, "media_discovery", "done", "Uploads-only mode; automatic TikTok/product-media discovery skipped");
    } else {
      const discovery = await autoDiscoverProjectMedia(project, research, defaults);
      await repo.updateProject(projectId, (p) => {
        const existingSources = new Set(p.assets.map((asset) => asset.sourceUrl).filter(Boolean));
        for (const asset of discovery.assets) if (!asset.sourceUrl || !existingSources.has(asset.sourceUrl)) p.assets.push(asset);
        p.mediaDiscovery = discovery.report;
        if (discovery.report.notes.length) {
          p.build = p.build || {};
          p.build.warnings = [...(p.build.warnings || []), ...discovery.report.notes];
        }
      });
      const downloadedVideos = discovery.report.videoCandidates.filter((item) => item.downloaded).length;
      const embedFallbacks = discovery.report.videoCandidates.filter((item) => !item.downloaded).length;
      const imageCount = discovery.report.imageCandidates.filter((item) => item.downloaded).length;
      await setStep(projectId, "media_discovery", "done", `${discovery.report.videoCandidates.length} TikTok post(s) selected · ${downloadedVideos} downloaded for analysis · ${embedFallbacks} embed fallback(s) · ${imageCount} product reference(s)`);
    }

    await setStep(projectId, "video_analysis", "running", "Analyzing sourced/uploaded creative and identifying the strongest proof moments");
    project = await current(projectId);
    const dir = await projectDir(projectId);
    const analyses: VideoAnalysis[] = [];
    const clipAssets: AssetRef[] = [];
    const existingClips = new Map<string, AssetRef>(project.assets.filter((asset) => asset.kind === "clip").map((asset) => [asset.name, asset] as [string, AssetRef]));
    const localVideos = project.assets.filter((asset) => asset.kind === "video" && asset.localPath);
    for (const asset of localVideos) {
      const analysis = await analyzeVideo(asset.id, asset.localPath!, dir);
      analysis.sourceProvider = asset.sourceProvider === "tiktok" ? "tiktok" : "upload";
      analysis.sourceUrl = asset.sourceUrl;
      analysis.embedUrl = asset.embedUrl;
      analysis.posterUrl = asset.posterUrl;
      analysis.discovered = asset.discovered;
      analyses.push(analysis);
      const clipDir = path.join(dir, "clips");
      await fs.mkdir(clipDir, { recursive: true });
      const clipPath = path.join(clipDir, `${path.parse(asset.name).name}-store.mp4`);
      try {
        await createStoreClip(asset.localPath!, clipPath, analysis.suggestedClip.start, analysis.suggestedClip.end);
        const stat = await fs.stat(clipPath);
        const name = path.basename(clipPath);
        const existing = existingClips.get(name);
        const rehostAllowed = asset.sourceProvider !== "tiktok" || !asset.discovered || defaults.allowRehostDiscoveredVideos;
        clipAssets.push({ id: existing?.id || crypto.randomUUID(), kind: "clip", name, mimeType: "video/mp4", size: stat.size, localPath: clipPath, shopifyFileId: existing?.shopifyFileId, shopifyUrl: existing?.shopifyUrl, createdAt: existing?.createdAt || new Date().toISOString(), sourceProvider: asset.sourceProvider, sourceUrl: asset.sourceUrl, embedUrl: asset.embedUrl, posterUrl: asset.posterUrl, discovered: asset.discovered, publishable: rehostAllowed });
      } catch {}
    }
    const externalVideos = project.assets.filter((asset) => asset.kind === "external_video" && asset.sourceProvider === "tiktok");
    for (const asset of externalVideos) {
      const candidate = project.mediaDiscovery?.videoCandidates.find((item) => item.url === asset.sourceUrl);
      analyses.push(externalTikTokAnalysis(asset, candidate));
    }
    await repo.updateProject(projectId, (p) => { p.videos = analyses; p.assets = p.assets.filter((asset) => asset.kind !== "clip"); p.assets.push(...clipAssets); });
    await setStep(projectId, "video_analysis", "done", `${analyses.length} creator creative(s) analyzed · ${clipAssets.length} storefront clip(s) prepared`);

    await setStep(projectId, "strategy", "running", "Retrieving learned store patterns and synthesizing the sales narrative");
    project = await current(projectId);
    const buildDefaults = await repo.getBuildDefaults();
    const margin = project.cost && project.sellingPrice ? `${Math.round((1 - project.cost / project.sellingPrice) * 100)}% gross margin before fees/ads/fulfillment` : "margin not fully supplied";
    const commercialContext = `Cost: ${project.cost ?? "unknown"}; selling price: ${project.sellingPrice ?? "unknown"}; compare-at: ${project.compareAtPrice ?? "none"}; ${margin}; bundle recommendations ${buildDefaults.enableBundleRecommendations ? "enabled" : "disabled"}. Never invent a discount or savings amount.`;
    const memory = await prepareReferenceMemory(project.research!, project.referenceUrl);
    await repo.updateProject(projectId, (p) => { p.referenceMemory = memory.use; });
    const strategy = await synthesizeStrategy(project.research!, project.videos || [], project.referenceUrl, commercialContext, memory.selected);
    await repo.updateProject(projectId, (p) => { p.strategy = strategy; });
    const memoryDetail = memory.selected.length ? `${memory.selected.length} Reference Brain store(s) used${memory.autoDiscovered ? ` · ${memory.autoDiscovered} newly discovered` : ""}` : "No learned references available; using product + UGC intelligence";
    await setStep(projectId, "strategy", "done", `${strategy.heroHeading} · ${memoryDetail}`);

    await setStep(projectId, "conversion_scan", "running", "Scouring category-specific PDP modules, decision aids, objections, trust, and mobile conversion patterns");
    project = await current(projectId);
    if (buildDefaults.enableConversionOpportunityScan) {
      const conversionPlan = await discoverConversionOpportunities({ research: project.research!, strategy: project.strategy!, videos: project.videos || [], defaults: buildDefaults, referenceMemory: project.referenceMemory });
      await repo.updateProject(projectId, (p) => { p.conversionPlan = conversionPlan; });
      const included = conversionPlan.modules.filter((module) => module.status === "include").length;
      const needsInput = conversionPlan.modules.filter((module) => module.status === "needs_input").length;
      await setStep(projectId, "conversion_scan", "done", `${conversionPlan.coverageScore}% coverage · ${included} modules selected · ${needsInput} need merchant truth`);
    } else {
      await setStep(projectId, "conversion_scan", "done", "Conversion opportunity scan disabled in Settings");
    }

    await setStep(projectId, "creative", "running", "Generating product-faithful ecommerce photography from uploaded or automatically sourced exact-SKU references");
    project = await current(projectId);
    const generated = await generateCreative(project);
    if (generated.length) await repo.updateProject(projectId, (p) => { p.assets = p.assets.filter((asset) => asset.kind !== "generated_image"); p.assets.push(...generated); });
    const refCount = project.assets.filter((asset) => asset.kind === "image" && asset.localPath).length;
    await setStep(projectId, "creative", "done", generated.length ? `${generated.length} product-faithful image(s) generated from ${refCount} reference(s)` : refCount ? "Using product references; image generation did not return approved assets" : "No usable product reference imagery was found; store may need a real product reference for faithful photography");

    project = await current(projectId);
    if (!project.storeId) {
      await setStep(projectId, "shopify_product", "blocked", "Connect a Shopify store and select it on this project");
      await setStep(projectId, "theme", "blocked", "Select an installed Shrine master theme");
      await setStep(projectId, "ugc", project.videos?.some((video) => video.embedUrl) ? "done" : "blocked", project.videos?.some((video) => video.embedUrl) ? "TikTok creator posts discovered and ready for attributed embed once Shopify is connected" : "Shopify store connection required");
      await setStep(projectId, "qa", "blocked", "Shopify preview is not available yet");
      await repo.updateProject(projectId, (p) => { p.status = "blocked"; });
      return;
    }

    await setStep(projectId, "shopify_product", "running", "Uploading approved assets and creating the Shopify product");
    const uploaded = await uploadAssetsToShopify(project);
    if (uploaded.warning) await repo.updateProject(projectId, (p) => { p.build = p.build || {}; p.build.warnings = [...(p.build.warnings || []), uploaded.warning]; });
    project = await current(projectId);
    const product = await createOrUpdateProduct(project, uploaded.images);
    await repo.updateProject(projectId, (p) => {
      p.build = p.build || {};
      p.build.productId = product.id;
      p.build.productHandle = product.handle;
      if (product.publicationWarning) p.build.warnings = [...(p.build.warnings || []), product.publicationWarning];
    });
    await setStep(projectId, "shopify_product", "done", product.publicationWarning ? `${product.title} · publication needs attention` : product.publicationHeld ? `${product.title} · Online Store publication held for approval` : `${product.title} · published to Online Store`);

    project = await current(projectId);
    if (!project.baseThemeId) {
      await setStep(projectId, "theme", "blocked", "Choose Shrine (or another compatible master theme) in Project settings");
      const embedCount = project.videos?.filter((video) => video.embedUrl).length || 0;
      await setStep(projectId, "ugc", uploaded.videos.length || embedCount ? "done" : "blocked", `${uploaded.videos.length} Shopify video(s) · ${embedCount} TikTok embed(s) ready`);
      await setStep(projectId, "qa", "blocked", "Theme preview is required for QA");
      await repo.updateProject(projectId, (p) => { p.status = "blocked"; });
      return;
    }

    project = await current(projectId);
    const storefrontVideos = storefrontVideoUrls(project, buildDefaults.allowRehostDiscoveredVideos);
    const embedCount = storefrontVideos.filter((url) => url.includes("tiktok.com/player/")).length;

    await setStep(projectId, "theme", "running", "Duplicating Shrine and injecting editable StoreForge sections");
    project = await current(projectId);
    const theme = await duplicateAndBuildTheme(project, storefrontVideos, uploaded.images);
    await repo.updateProject(projectId, (p) => { p.build = { ...(p.build || {}), ...theme, shopifyVideoUrls: uploaded.videos }; });
    await setStep(projectId, "theme", "done", theme.themeName);

    await setStep(projectId, "ugc", storefrontVideos.length ? "done" : "blocked", storefrontVideos.length ? `${storefrontVideos.length} creator video(s) integrated (${storefrontVideos.length - embedCount} Shopify-hosted · ${embedCount} attributed TikTok embed${embedCount === 1 ? "" : "s"})` : "No usable creator videos were discovered or uploaded");
    const qaSatisfied = await runVisualQaLoop(projectId, uploaded.images, storefrontVideos);
    await repo.updateProject(projectId, (p) => { p.status = qaSatisfied && !p.steps.some((s) => s.status === "blocked" || s.status === "failed") ? "complete" : "blocked"; });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await repo.updateProject(projectId, (p) => {
      p.status = "failed";
      const runningStep = p.steps.find((s) => s.status === "running");
      if (runningStep) { runningStep.status = "failed"; runningStep.detail = message; runningStep.finishedAt = new Date().toISOString(); }
      p.build = p.build || {}; p.build.warnings = [...(p.build.warnings || []), message];
    }).catch(() => {});
  } finally {
    running.delete(projectId);
  }
}

export function startBuild(projectId: string) {
  void runBuild(projectId);
}
