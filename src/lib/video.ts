import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import { transcribeAudio, openaiJson } from "@/lib/openai";
import type { VideoAnalysis } from "@/lib/types";
import { z } from "zod";

const exec = promisify(execFile);

const videoAnalysisSchema = z.object({
  hook: z.string(),
  angle: z.string(),
  audience: z.string(),
  visualBeats: z.array(z.string()).default([]),
  proof: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
  claimRisks: z.array(z.string()).default([]),
  bestStoreUse: z.string(),
  suggestedClip: z.object({ start: z.number(), end: z.number(), label: z.string() }),
});

async function ffprobeDuration(file: string) {
  const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]);
  return Math.max(1, Number.parseFloat(stdout.trim()) || 1);
}

export async function analyzeVideo(assetId: string, filePath: string, workDir: string): Promise<VideoAnalysis> {
  const duration = await ffprobeDuration(filePath);
  const frameDir = path.join(workDir, `frames-${assetId}`);
  await fs.mkdir(frameDir, { recursive: true });
  const times = [0.05, 0.22, 0.42, 0.62, 0.82].map((p) => Math.max(0, duration * p));
  const frames: string[] = [];
  for (let i = 0; i < times.length; i++) {
    const target = path.join(frameDir, `frame-${i + 1}.jpg`);
    await exec("ffmpeg", ["-y", "-ss", times[i].toFixed(2), "-i", filePath, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "3", target]);
    frames.push(target);
  }
  const audio = path.join(frameDir, "audio.mp3");
  try { await exec("ffmpeg", ["-y", "-i", filePath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", audio]); } catch {}
  let transcript = "";
  try { transcript = await transcribeAudio(audio); } catch {}

  let analysis: Omit<VideoAnalysis, "assetId" | "filename" | "durationSeconds" | "transcript" | "posterPath">;
  try {
    const raw = await openaiJson<unknown>(`You are a direct-response ecommerce creative strategist. Analyze these sampled frames from one product marketing video plus its transcript.
Transcript: ${transcript || "No transcript available."}
Video duration: ${duration.toFixed(1)} seconds.
Return JSON with exactly: hook (string), angle (string), audience (string), visualBeats (string[]), proof (string[]), objections (string[]), claimRisks (string[]), bestStoreUse (string), suggestedClip ({start:number,end:number,label:string}). suggestedClip should be the strongest 8-20 second window and stay within the video duration.`, frames);
    analysis = videoAnalysisSchema.parse(raw);
  } catch {
    analysis = {
      hook: "Creator-led product demonstration",
      angle: "Visual product transformation",
      audience: "Shoppers who want to see the product work before buying",
      visualBeats: ["Product introduced", "Application shown", "Result revealed"],
      proof: ["Real creator application"],
      objections: ["Will it work for me?"],
      claimRisks: ["Avoid universal results claims"],
      bestStoreUse: "UGC proof carousel",
      suggestedClip: { start: 0, end: Math.min(18, Math.floor(duration)), label: "Best demo moment" },
    };
  }
  const rawStart = Number(analysis.suggestedClip?.start) || 0;
  const rawEnd = Number(analysis.suggestedClip?.end) || Math.min(duration, rawStart + 18);
  const start = Math.max(0, Math.min(rawStart, Math.max(0, duration - 4)));
  const end = Math.max(start + Math.min(4, duration - start), Math.min(duration, Math.min(rawEnd, start + 20)));
  analysis.suggestedClip = { start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10, label: analysis.suggestedClip?.label || "Best demo moment" };
  return {
    assetId,
    filename: path.basename(filePath),
    durationSeconds: Math.round(duration * 10) / 10,
    transcript,
    ...analysis,
    posterPath: frames[0],
  };
}

export async function createStoreClip(inputPath: string, outputPath: string, start: number, end: number) {
  const duration = Math.max(4, end - start);
  await exec("ffmpeg", ["-y", "-ss", String(Math.max(0, start)), "-i", inputPath, "-t", String(duration), "-vf", "scale=720:-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", outputPath]);
  return outputPath;
}
