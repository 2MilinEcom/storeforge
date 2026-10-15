import crypto from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { env } from "@/lib/env";
import { openaiJson } from "@/lib/openai";
import { projectDir } from "@/lib/repository";
import type { AssetRef, BuildDefaults, MediaDiscoveryImage, MediaDiscoveryReport, MediaDiscoveryVideo, ProductResearch, Project, VideoAnalysis } from "@/lib/types";

const execFileAsync = promisify(execFile);

const candidateSchema = z.object({
  videos: z.array(z.object({
    url: z.string().url(),
    query: z.string().default(""),
    angle: z.string().default("Creator product demo"),
    reason: z.string().default("Relevant product demonstration"),
  })).default([]),
});

const productPageSchema = z.object({
  pageUrls: z.array(z.string().url()).default([]),
});

type OEmbed = {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function cleanTerms(project: Project, research: ProductResearch) {
  return unique([
    ...(project.videoSearchTerms || []),
    research.productName,
    research.category,
    ...research.features.slice(0, 4),
    ...research.benefits.slice(0, 3),
  ].map((x) => String(x || "").trim()).filter(Boolean)).slice(0, 12);
}

function tiktokPostId(url: string) {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] || "";
}

function normalizeTikTokUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/(^|\.)tiktok\.com$/i.test(url.hostname)) return "";
    const id = tiktokPostId(url.toString());
    if (!id) return "";
    const userMatch = url.pathname.match(/^\/(?:@[^/]+)\/video\/(\d+)/);
    return userMatch ? `https://www.tiktok.com${url.pathname.split("?")[0]}` : `https://www.tiktok.com/video/${id}`;
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function tiktokOEmbed(url: string): Promise<OEmbed> {
  try {
    const response = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0 StoreForge/0.6" },
    });
    if (!response.ok) return {};
    return await response.json() as OEmbed;
  } catch {
    return {};
  }
}

export async function discoverTikTokCandidates(project: Project, research: ProductResearch, count: number) {
  const terms = cleanTerms(project, research);
  if (!env.openaiKey) return { terms, candidates: [] as MediaDiscoveryVideo[] };
  const raw = await openaiJson<unknown>(`Find public TikTok creator videos that are genuinely relevant to this ecommerce product.
PRODUCT URL: ${project.productUrl}
PRODUCT: ${research.productName}
CATEGORY: ${research.category}
PRODUCT SUMMARY: ${research.summary}
SEARCH TERMS: ${JSON.stringify(terms)}

Use web search. Return only real TikTok post URLs in the form https://www.tiktok.com/@creator/video/POST_ID. Do not return TikTok Shop product pages, search pages, profiles, hashtag pages, ads-library URLs, YouTube, Instagram, or generic articles.

Prioritize a varied set of useful direct-response angles: first impression, product demonstration, problem/solution, comparison, objection handling, close-up proof, mature/younger audience when relevant, and before/after only when the public creator video itself legitimately demonstrates it. Avoid duplicates and unrelated videos. Search broadly enough to find the exact product even when creator captions use informal names.

Return JSON exactly: {"videos":[{"url":"...","query":"search phrase that found it","angle":"what angle this video appears to cover","reason":"why it is useful for this product page"}]}. Return up to ${Math.min(Math.max(count * 3, 10), 30)} ranked candidates.`, [], true);
  const parsed = candidateSchema.parse(raw);
  const seen = new Set<string>();
  const candidates: MediaDiscoveryVideo[] = [];
  for (const item of parsed.videos) {
    const normalized = normalizeTikTokUrl(item.url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    const postId = tiktokPostId(normalized);
    if (!postId) continue;
    const meta = await tiktokOEmbed(normalized);
    candidates.push({
      url: normalized,
      embedUrl: `https://www.tiktok.com/player/v1/${postId}?controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=1&loop=0&autoplay=0&description=0&music_info=0&rel=0`,
      postId,
      title: meta.title || item.angle,
      author: meta.author_name || "TikTok creator",
      angle: item.angle,
      reason: item.reason,
      query: item.query,
      thumbnailUrl: meta.thumbnail_url,
      downloaded: false,
    });
    if (candidates.length >= Math.min(Math.max(count * 2, count), 20)) break;
  }
  return { terms, candidates };
}

function ytDlpFileName() {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  return "yt-dlp";
}

async function executableExists(command: string) {
  try {
    await execFileAsync(command, ["--version"], { timeout: 8000, maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

async function ensureYtDlp() {
  if (env.ytDlpPath && await executableExists(env.ytDlpPath)) return env.ytDlpPath;
  if (await executableExists("yt-dlp")) return "yt-dlp";
  const dir = path.join(process.cwd(), "data", "bin");
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  if (await executableExists(target)) return target;
  if (!env.autoDownloadYtDlp) throw new Error("yt-dlp is not installed and AUTO_DOWNLOAD_YTDLP is disabled");
  const source = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytDlpFileName()}`;
  const response = await fetchWithTimeout(source, { headers: { "User-Agent": "StoreForge/0.6" } }, 30000);
  if (!response.ok) throw new Error(`Could not bootstrap yt-dlp (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(target, bytes);
  if (process.platform !== "win32") await fs.chmod(target, 0o755);
  if (!await executableExists(target)) throw new Error("Downloaded yt-dlp could not execute");
  return target;
}

async function downloadTikTok(candidate: MediaDiscoveryVideo, outputPath: string) {
  const executable = await ensureYtDlp();
  const args = [
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--restrict-filenames",
    "--merge-output-format", "mp4",
    "-f", "bv*+ba/b",
    "-o", outputPath,
  ];
  if (env.ytDlpCookiesFromBrowser) args.push("--cookies-from-browser", env.ytDlpCookiesFromBrowser);
  args.push(candidate.url);
  await execFileAsync(executable, args, { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
  await fs.access(outputPath);
  return outputPath;
}

function htmlImageUrls(html: string, pageUrl: string) {
  const found: string[] = [];
  const add = (value: string) => {
    let raw = value.trim().replace(/&amp;/g, "&").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
    if (!raw || raw.startsWith("data:")) return;
    if (raw.startsWith("//")) raw = `https:${raw}`;
    try {
      const url = new URL(raw, pageUrl);
      if (!/^https?:$/.test(url.protocol)) return;
      found.push(url.toString());
    } catch {}
  };
  for (const regex of [
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["']/gi,
    /<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/gi,
  ]) {
    let match;
    while ((match = regex.exec(html))) add(match[1]);
  }
  let srcset;
  const srcsetRegex = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  while ((srcset = srcsetRegex.exec(html))) {
    for (const part of srcset[1].split(",")) add(part.trim().split(/\s+/)[0]);
  }
  const jsonUrls = html.match(/https?:\\?\/\\?\/[^"'<>\s]+/g) || [];
  for (const raw of jsonUrls.slice(0, 300)) if (/\.(?:png|jpe?g|webp|avif)(?:\?|$)/i.test(raw)) add(raw);
  return unique(found);
}

async function fetchPageImages(pageUrl: string) {
  try {
    const response = await fetchWithTimeout(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }, 15000);
    if (!response.ok) return [];
    const html = await response.text();
    return htmlImageUrls(html, response.url || pageUrl);
  } catch {
    return [];
  }
}

function extForMime(mime: string) {
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("avif")) return ".avif";
  return ".jpg";
}

async function dimensions(filePath: string) {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", filePath], { timeout: 8000 });
    const [width, height] = stdout.trim().split("x").map(Number);
    return { width: width || 0, height: height || 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

async function downloadProductImage(url: string, dir: string, index: number) {
  const response = await fetchWithTimeout(url, {
    headers: { "User-Agent": "Mozilla/5.0 StoreForge/0.6", Referer: new URL(url).origin },
  }, 18000);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const mime = response.headers.get("content-type") || "";
  if (!mime.startsWith("image/")) throw new Error(`Not an image (${mime || "unknown content type"})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 12000) throw new Error("Image is too small");
  if (bytes.length > 18 * 1024 * 1024) throw new Error("Image is too large");
  const target = path.join(dir, `reference-${index + 1}${extForMime(mime)}`);
  await fs.writeFile(target, bytes);
  const size = await dimensions(target);
  if (size.width && size.height && Math.min(size.width, size.height) < 280) {
    await fs.unlink(target).catch(() => {});
    throw new Error("Image dimensions are too small");
  }
  return { target, mime, bytes: bytes.length };
}

async function relatedProductPages(project: Project, research: ProductResearch) {
  if (!env.openaiKey) return [] as string[];
  try {
    const raw = await openaiJson<unknown>(`Find authoritative public product pages for this exact SKU so StoreForge can obtain faithful product-reference photography for visual analysis and image-generation reference. Prioritize the supplied product URL, the official brand/manufacturer, authorized retailers, supplier listings, and exact-title marketplace listings. Do not return generic category pages or unrelated lookalikes.
PRODUCT URL: ${project.productUrl}
PRODUCT NAME: ${research.productName}
CATEGORY: ${research.category}
FEATURES: ${JSON.stringify(research.features)}
Return JSON exactly: {"pageUrls":["https://..."]}. Return no more than 8 pages.`, [], true);
    return unique(productPageSchema.parse(raw).pageUrls);
  } catch {
    return [];
  }
}

export async function discoverProductReferences(project: Project, research: ProductResearch, count: number) {
  const dir = path.join(await projectDir(project.id), "auto-media", "images");
  await fs.mkdir(dir, { recursive: true });
  const pages = unique([project.productUrl, ...(await relatedProductPages(project, research))]);
  const existing = new Set(project.assets.filter((asset) => asset.kind === "image" && asset.sourceUrl).map((asset) => asset.sourceUrl));
  const candidates: MediaDiscoveryImage[] = [];
  const assets: AssetRef[] = [];
  let imageIndex = 0;
  for (const pageUrl of pages) {
    const urls = await fetchPageImages(pageUrl);
    for (const imageUrl of urls) {
      if (existing.has(imageUrl)) continue;
      const entry: MediaDiscoveryImage = { url: imageUrl, pageUrl, downloaded: false };
      try {
        const downloaded = await downloadProductImage(imageUrl, dir, imageIndex);
        const asset: AssetRef = {
          id: crypto.randomUUID(),
          kind: "image",
          name: path.basename(downloaded.target),
          mimeType: downloaded.mime,
          size: downloaded.bytes,
          localPath: downloaded.target,
          createdAt: new Date().toISOString(),
          sourceProvider: pageUrl === project.productUrl ? "product_page" : "web",
          sourceUrl: imageUrl,
          originPage: pageUrl,
          discovered: true,
          publishable: false,
        };
        assets.push(asset);
        entry.downloaded = true;
        entry.localAssetId = asset.id;
        imageIndex += 1;
      } catch (error) {
        entry.error = error instanceof Error ? error.message : String(error);
      }
      candidates.push(entry);
      if (assets.length >= count) return { assets, candidates, pages };
    }
  }
  return { assets, candidates, pages };
}

export async function discoverTikTokVideos(project: Project, research: ProductResearch, count: number) {
  const { terms, candidates } = await discoverTikTokCandidates(project, research, count);
  const dir = path.join(await projectDir(project.id), "auto-media", "tiktok");
  await fs.mkdir(dir, { recursive: true });
  const existing = new Set(project.assets.filter((asset) => asset.sourceUrl).map((asset) => asset.sourceUrl));
  const assets: AssetRef[] = [];
  const selected: MediaDiscoveryVideo[] = [];
  for (const candidate of candidates) {
    if (selected.length >= count) break;
    if (existing.has(candidate.url)) {
      selected.push(candidate);
      continue;
    }
    const base = `${String(selected.length + 1).padStart(2, "0")}-${candidate.postId}`;
    const target = path.join(dir, `${base}.mp4`);
    try {
      await downloadTikTok(candidate, target);
      const stat = await fs.stat(target);
      const asset: AssetRef = {
        id: crypto.randomUUID(),
        kind: "video",
        name: `${base}.mp4`,
        mimeType: "video/mp4",
        size: stat.size,
        localPath: target,
        createdAt: new Date().toISOString(),
        sourceProvider: "tiktok",
        sourceUrl: candidate.url,
        embedUrl: candidate.embedUrl,
        posterUrl: candidate.thumbnailUrl,
        discovered: true,
        publishable: false,
      };
      assets.push(asset);
      candidate.downloaded = true;
      candidate.localAssetId = asset.id;
    } catch (error) {
      const asset: AssetRef = {
        id: crypto.randomUUID(),
        kind: "external_video",
        name: `tiktok-${candidate.postId}`,
        mimeType: "text/uri-list",
        size: 0,
        createdAt: new Date().toISOString(),
        sourceProvider: "tiktok",
        sourceUrl: candidate.url,
        embedUrl: candidate.embedUrl,
        posterUrl: candidate.thumbnailUrl,
        discovered: true,
        publishable: false,
        error: error instanceof Error ? error.message : String(error),
      };
      assets.push(asset);
      candidate.error = asset.error;
    }
    selected.push(candidate);
  }
  return { terms, candidates: selected, assets };
}

export function externalTikTokAnalysis(asset: AssetRef, candidate?: MediaDiscoveryVideo): VideoAnalysis {
  const title = candidate?.title || asset.name || "TikTok creator demo";
  return {
    assetId: asset.id,
    filename: asset.name,
    durationSeconds: 0,
    transcript: title,
    hook: title,
    angle: candidate?.angle || "Creator demonstration",
    audience: "TikTok shoppers researching this product",
    visualBeats: ["Public TikTok creator post"],
    proof: ["Creator-led public product content"],
    objections: [],
    claimRisks: ["Do not treat creator statements as verified product facts"],
    bestStoreUse: "Attributed TikTok embed",
    suggestedClip: { start: 0, end: 0, label: "Use original TikTok embed" },
    sourceProvider: "tiktok",
    sourceUrl: asset.sourceUrl,
    embedUrl: asset.embedUrl,
    posterUrl: asset.posterUrl,
    discovered: true,
  };
}

export async function autoDiscoverProjectMedia(project: Project, research: ProductResearch, defaults: BuildDefaults) {
  const mode = project.mediaSourceMode || "auto";
  const wantsAuto = mode !== "uploads";
  const notes: string[] = [];
  const existingVideos = project.assets.filter((asset) => asset.kind === "video" || asset.kind === "external_video");
  const existingImages = project.assets.filter((asset) => asset.kind === "image");

  let videoResult = { terms: cleanTerms(project, research), candidates: [] as MediaDiscoveryVideo[], assets: [] as AssetRef[] };
  let imageResult = { assets: [] as AssetRef[], candidates: [] as MediaDiscoveryImage[], pages: [] as string[] };

  if (wantsAuto && defaults.autoDiscoverTikTokVideos && existingVideos.length < defaults.autoTikTokVideoCount) {
    try {
      videoResult = await discoverTikTokVideos(project, research, defaults.autoTikTokVideoCount);
      if (!videoResult.candidates.length) notes.push("No public TikTok post URLs were found by web discovery for this product.");
      if (videoResult.candidates.some((item) => item.error)) notes.push("Some TikTok posts could not be downloaded; StoreForge will use official TikTok embeds for those posts instead.");
    } catch (error) {
      notes.push(`TikTok discovery error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (wantsAuto && defaults.autoDiscoverProductImages && existingImages.length < 1) {
    try {
      imageResult = await discoverProductReferences(project, research, defaults.autoProductImageCount);
      if (!imageResult.assets.length) notes.push("No downloadable product-reference images were found automatically. Uploading a real product reference will improve image fidelity.");
    } catch (error) {
      notes.push(`Product image discovery error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const report: MediaDiscoveryReport = {
    searchTerms: videoResult.terms,
    videoCandidates: videoResult.candidates,
    imageCandidates: imageResult.candidates,
    discoveredAt: new Date().toISOString(),
    notes,
  };
  return { report, assets: [...videoResult.assets, ...imageResult.assets] };
}
