import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
  throw new Error("Model did not return valid JSON");
}

export async function openaiJson<T>(instruction: string, imagePaths: string[] = [], useWebSearch = false): Promise<T> {
  if (!env.openaiKey) throw new Error("OPENAI_API_KEY is not configured");
  const content: any[] = [{ type: "input_text", text: `${instruction}\n\nReturn valid JSON only. Do not wrap it in markdown.` }];
  for (const imagePath of imagePaths.slice(0, 12)) {
    const data = await fs.readFile(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    content.push({ type: "input_image", image_url: `data:${mime};base64,${data.toString("base64")}`, detail: "high" });
  }
  const body: any = {
    model: env.openaiTextModel,
    input: [{ role: "user", content }],
  };
  if (useWebSearch) body.tools = [{ type: "web_search" }];
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`OpenAI Responses API ${response.status}: ${JSON.stringify(json)}`);
  return parseJson<T>(extractOutputText(json));
}

export async function transcribeAudio(filePath: string) {
  if (!env.openaiKey) return "";
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.set("model", env.openaiTranscribeModel);
  form.set("file", new Blob([bytes]), path.basename(filePath));
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.openaiKey}` },
    body: form,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`OpenAI transcription ${response.status}: ${JSON.stringify(json)}`);
  return String(json.text || "");
}

export async function editProductImage(referencePath: string, prompt: string, outputPath: string) {
  if (!env.openaiKey) throw new Error("OPENAI_API_KEY is not configured");
  const bytes = await fs.readFile(referencePath);
  const form = new FormData();
  form.set("model", env.openaiImageModel);
  form.set("prompt", prompt);
  form.set("size", "1024x1024");
  form.set("image", new Blob([bytes]), path.basename(referencePath));
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.openaiKey}` },
    body: form,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`OpenAI image edit ${response.status}: ${JSON.stringify(json)}`);
  const b64 = json?.data?.[0]?.b64_json;
  const url = json?.data?.[0]?.url;
  if (b64) {
    await fs.writeFile(outputPath, Buffer.from(b64, "base64"));
    return outputPath;
  }
  if (url) {
    const image = await fetch(url);
    await fs.writeFile(outputPath, Buffer.from(await image.arrayBuffer()));
    return outputPath;
  }
  throw new Error("Image API returned no image data");
}
