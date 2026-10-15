"use client";

import { useState } from "react";

export function DirectShopifyUpload(props: { storeId: string; projectId: string; assetId: string; assetName: string; mimeType: string; onDone?: () => void }) {
  const [state, setState] = useState<"idle"|"uploading"|"done"|"error">("idle");
  const [message, setMessage] = useState("");
  async function run() {
    setState("uploading"); setMessage("Preparing Shopify upload…");
    try {
      const assetResponse = await fetch(`/api/assets/${props.projectId}/${props.assetId}`);
      if (!assetResponse.ok) throw new Error("Could not read the local asset");
      const blob = await assetResponse.blob();
      const stageResponse = await fetch("/api/shopify/uploads/stage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: props.storeId, resource: "VIDEO", filename: props.assetName, mimeType: props.mimeType || "video/mp4", fileSize: String(blob.size) }) });
      const stage = await stageResponse.json();
      if (!stageResponse.ok) throw new Error(stage.error || "Shopify staging failed");
      setMessage("Uploading directly from your browser to Shopify…");
      const form = new FormData();
      for (const p of stage.parameters || []) form.append(p.name, p.value);
      form.append("file", new File([blob], props.assetName, { type: props.mimeType || "video/mp4" }));
      const upload = await fetch(stage.url, { method: "POST", body: form });
      if (!upload.ok) throw new Error(`Shopify storage upload failed (${upload.status})`);
      setMessage("Finalizing Shopify video…");
      const completeResponse = await fetch("/api/shopify/uploads/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: props.storeId, kind: "video", resourceUrl: stage.resourceUrl, filename: props.assetName, alt: props.assetName, projectId: props.projectId, assetId: props.assetId }) });
      let complete = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(complete.error || "Shopify file creation failed");
      if (!complete.ready && complete.id) {
        setMessage("Shopify is processing the video…");
        for (let attempt = 0; attempt < 45 && !complete.ready; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const statusResponse = await fetch("/api/shopify/uploads/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: props.storeId, fileId: complete.id, projectId: props.projectId, assetId: props.assetId }) });
          complete = await statusResponse.json();
          if (!statusResponse.ok) throw new Error(complete.error || "Could not check Shopify video status");
        }
      }
      if (!complete.ready) throw new Error("Shopify is still processing the video. Try again in a moment; the uploaded file has been saved.");
      setState("done"); setMessage("Uploaded to Shopify"); props.onDone?.();
    } catch (error) {
      setState("error"); setMessage(error instanceof Error ? error.message : String(error));
    }
  }
  return <div className="direct-upload"><button className="button mini" disabled={state === "uploading" || state === "done"} onClick={run}>{state === "done" ? "Uploaded ✓" : state === "uploading" ? "Uploading…" : "Upload to Shopify"}</button>{message && <small>{message}</small>}</div>;
}
