#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access, mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { constants } from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
function add(name, ok, detail) { checks.push({ name, ok, detail }); }

const major = Number(process.versions.node.split(".")[0]);
add("Node.js 22+", major >= 22, process.version);

for (const bin of ["ffmpeg", "ffprobe"]) {
  const result = spawnSync(bin, ["-version"], { encoding: "utf8" });
  add(bin, result.status === 0, result.status === 0 ? (result.stdout.split("\n")[0] || "available") : "not found");
}

const ytDlpCandidates = [process.env.YTDLP_PATH, path.join(root, "data", "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"), "yt-dlp"].filter(Boolean);
let ytDlpDetail = "not installed yet — StoreForge will bootstrap the official yt-dlp binary on the first automatic TikTok sourcing run";
let ytDlpOk = false;
for (const candidate of ytDlpCandidates) {
  const result = spawnSync(String(candidate), ["--version"], { encoding: "utf8" });
  if (result.status === 0) { ytDlpOk = true; ytDlpDetail = `${candidate} · ${(result.stdout || "").trim() || "available"}`; break; }
}
add("TikTok media downloader", ytDlpOk, ytDlpDetail);

const chromeCandidates = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => existsSync(candidate));
add("Chrome / Chromium", Boolean(chrome), chrome || "not found (visual QA will be unavailable; set CHROME_PATH if installed elsewhere)");

try {
  await mkdir(path.join(root, "data"), { recursive: true });
  const probe = path.join(root, "data", ".doctor-write-test");
  await writeFile(probe, "ok");
  await access(probe, constants.R_OK | constants.W_OK);
  await unlink(probe);
  add("Local data directory", true, "writable");
} catch (error) {
  add("Local data directory", false, error instanceof Error ? error.message : String(error));
}

const envChecks = [
  ["OPENAI_API_KEY", Boolean(process.env.OPENAI_API_KEY), "AI research / transcription / image generation"],
  ["SHOPIFY_API_KEY", Boolean(process.env.SHOPIFY_API_KEY), "Shopify OAuth"],
  ["SHOPIFY_API_SECRET", Boolean(process.env.SHOPIFY_API_SECRET), "Shopify OAuth"],
  ["APP_ENCRYPTION_KEY", Boolean(process.env.APP_ENCRYPTION_KEY), "Encrypted Shopify token storage"],
];
for (const [name, ok, purpose] of envChecks) add(String(name), Boolean(ok), ok ? "configured" : `missing (${purpose})`);

console.log("\nStoreForge doctor\n");
for (const check of checks) console.log(`${check.ok ? "PASS" : "WARN"}  ${check.name.padEnd(24)} ${check.detail}`);
const hardFailures = checks.filter((c) => !c.ok && ["Node.js 22+", "ffmpeg", "ffprobe", "Local data directory"].includes(c.name));
console.log(hardFailures.length ? "\nLocal build prerequisites need attention." : "\nLocal build prerequisites look good. Missing API credentials only disable their live integrations.");
process.exit(hardFailures.length ? 1 : 0);
