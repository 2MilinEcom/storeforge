"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Store = { id: string; shop: string; displayName: string };
type Theme = { id: string; name: string; role: string; processing?: boolean };

type MediaMode = "auto" | "uploads" | "auto_plus_uploads";

function splitTerms(value: string) {
  return [...new Set(value.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean))].slice(0, 20);
}

function bestTheme(themes: Theme[]) {
  const eligible = themes.filter((theme) => theme.role !== "MAIN" && !theme.processing);
  return eligible.find((theme) => /shrine/i.test(theme.name)) || eligible[0];
}

export function NewBuildWizard() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [storeId, setStoreId] = useState("");
  const [themeId, setThemeId] = useState("");
  const [videos, setVideos] = useState<File[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [mediaSourceMode, setMediaSourceMode] = useState<MediaMode>("auto");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [defaults, setDefaults] = useState<any>(null);

  useEffect(() => {
    fetch("/api/shopify/stores")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setStores(list);
        if (list.length === 1) setStoreId(list[0].id);
      })
      .catch(() => {});
    fetch("/api/build-settings").then((r) => r.json()).then(setDefaults).catch(() => {});
  }, []);

  useEffect(() => {
    if (!storeId) {
      setThemes([]);
      setThemeId("");
      return;
    }
    fetch(`/api/shopify/themes?storeId=${encodeURIComponent(storeId)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setThemes(list);
        const picked = bestTheme(list);
        setThemeId(picked?.id || "");
      })
      .catch(() => {
        setThemes([]);
        setThemeId("");
      });
  }, [storeId]);

  const destinationSummary = useMemo(() => {
    const store = stores.find((item) => item.id === storeId);
    const theme = themes.find((item) => item.id === themeId);
    if (!store) return "Research first · connect Shopify when ready";
    if (!theme) return `${store.displayName} · theme will be chosen after research`;
    return `${store.displayName} · ${theme.name}`;
  }, [stores, themes, storeId, themeId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const productUrl = String(form.get("productUrl") || "").trim();
      if (!productUrl) throw new Error("Paste the TikTok Shop or product URL first");

      const projectResponse = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || "").trim() || undefined,
          productUrl,
          referenceUrl: form.get("referenceUrl") || undefined,
          notes: form.get("notes") || "",
          mediaSourceMode,
          videoSearchTerms: splitTerms(String(form.get("videoSearchTerms") || "")),
          cost: form.get("cost") ? Number(form.get("cost")) : undefined,
          sellingPrice: form.get("sellingPrice") ? Number(form.get("sellingPrice")) : undefined,
          compareAtPrice: form.get("compareAtPrice") ? Number(form.get("compareAtPrice")) : undefined,
          currency: defaults?.defaultCurrency || "USD",
          storeId: storeId || undefined,
          baseThemeId: themeId || undefined,
        }),
      });
      const project = await projectResponse.json();
      if (!projectResponse.ok) throw new Error(project.error || "Could not create project");

      if (videos.length || images.length) {
        const upload = new FormData();
        [...videos, ...images].forEach((file) => upload.append("files", file));
        const assetsResponse = await fetch(`/api/projects/${project.id}/assets`, { method: "POST", body: upload });
        const assets = await assetsResponse.json();
        if (!assetsResponse.ok) throw new Error(assets.error || "Could not upload optional project files");
      }

      const buildResponse = await fetch(`/api/projects/${project.id}/build`, { method: "POST" });
      const build = await buildResponse.json().catch(() => ({}));
      if (!buildResponse.ok) throw new Error(build.error || "Project was created but the build could not start");
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return <>
    <header className="page-head">
      <div>
        <p className="eyebrow">ONE-URL STORE BUILD</p>
        <h1>Paste the TikTok Shop link. StoreForge does the rest.</h1>
        <p className="lede">The product URL is the primary input. StoreForge researches the SKU, extracts the public price and variants, generates its own search terms, finds creator TikToks and product references, studies competing stores, creates the Shopify product and Shrine build, then visually QA&apos;s and refines the result.</p>
      </div>
    </header>

    <form className="wizard" onSubmit={submit}>
      <section className="panel wizard-card url-first-card">
        <div className="step-num">01</div>
        <div className="wizard-body">
          <p className="eyebrow">START HERE</p>
          <h2>Give it the product.</h2>
          <label>Product / TikTok Shop URL
            <input
              name="productUrl"
              type="url"
              required
              autoFocus
              placeholder="https://shop.tiktok.com/..."
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
            />
          </label>
          <div className="inline-callout">
            <strong>Paste the link and press Enter.</strong>
            <span>No videos, photos, search terms, product name, selling price, inspiration store, or copy are required. StoreForge will try to derive all of those from the URL and public research. Anything it cannot verify stays unset rather than being invented.</span>
          </div>
          <div className="auto-plan-grid">
            <span>Research product</span><span>Find TikToks</span><span>Source product refs</span><span>Study reference stores</span><span>Build Shopify</span><span>Visual QA + retry</span>
          </div>
          <div className="one-click-row">
            <div><small className="muted">Destination</small><strong>{destinationSummary}</strong></div>
            <button className="button primary large" disabled={busy}>{busy ? "Starting autonomous build…" : "Build store from URL →"}</button>
          </div>
        </div>
      </section>

      <button type="button" className="advanced-toggle" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? "Hide advanced overrides ↑" : "Advanced overrides (optional) ↓"}
      </button>

      {showAdvanced && <>
        <section className="panel wizard-card"><div className="step-num">02</div><div className="wizard-body"><p className="eyebrow">OPTIONAL OVERRIDES</p><h2>Only tell StoreForge what it cannot know.</h2><div className="form-grid two"><label>Project name<input name="name" placeholder="Auto-named from the product" /></label><label>Reference / inspiration page<input name="referenceUrl" type="url" placeholder="Optional — Reference Brain can find these itself" /></label></div><label>Extra instructions<textarea name="notes" rows={3} placeholder="Supplier facts, brand direction, claims to avoid, special offer rules…" /></label><label>Extra video search guidance<textarea name="videoSearchTerms" rows={3} placeholder="Optional. StoreForge generates its own product/category/angle searches automatically." /></label><div className="form-grid three"><label>Known product cost<input name="cost" type="number" step="0.01" min="0" placeholder="Unknown is fine" /></label><label>Override selling price<input name="sellingPrice" type="number" step="0.01" min="0" placeholder="Use source price automatically" /></label><label>Override compare-at<input name="compareAtPrice" type="number" step="0.01" min="0" placeholder="Only if legitimate" /></label></div><p className="tiny">The TikTok/source selling price is used automatically when StoreForge can verify it. Product cost is intentionally not guessed because a retail TikTok page does not prove your supplier cost.</p></div></section>

        <section className="panel wizard-card"><div className="step-num">03</div><div className="wizard-body"><p className="eyebrow">MEDIA OVERRIDE</p><h2>Automatic is the default.</h2><div className="form-grid three"><label className="choice-card"><input type="radio" name="mediaMode" checked={mediaSourceMode === "auto"} onChange={() => setMediaSourceMode("auto")}/><strong>Automatic</strong><span>Find TikToks and exact-product references from the URL.</span></label><label className="choice-card"><input type="radio" name="mediaMode" checked={mediaSourceMode === "auto_plus_uploads"} onChange={() => setMediaSourceMode("auto_plus_uploads")}/><strong>Automatic + mine</strong><span>Add your own files but still search automatically.</span></label><label className="choice-card"><input type="radio" name="mediaMode" checked={mediaSourceMode === "uploads"} onChange={() => setMediaSourceMode("uploads")}/><strong>Uploads only</strong><span>Disable automatic media discovery for this build.</span></label></div><div className="drop-grid"><label className="dropzone"><span className="drop-icon">▶</span><strong>Optional videos</strong><small>{videos.length ? `${videos.length} selected` : "Not required"}</small><input type="file" accept="video/*" multiple onChange={(e) => setVideos(Array.from(e.target.files || []))} /></label><label className="dropzone"><span className="drop-icon">▧</span><strong>Optional product refs</strong><small>{images.length ? `${images.length} selected` : "Not required"}</small><input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files || []))} /></label></div></div></section>

        <section className="panel wizard-card"><div className="step-num">04</div><div className="wizard-body"><p className="eyebrow">SHOPIFY OVERRIDE</p><h2>Change the destination only when needed.</h2>{stores.length ? <div className="form-grid two"><label>Store<select value={storeId} onChange={(e) => setStoreId(e.target.value)}><option value="">Analyze only</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.displayName} · {store.shop}</option>)}</select></label><label>Master theme<select value={themeId} onChange={(e) => setThemeId(e.target.value)} disabled={!storeId}><option value="">Choose after analysis</option>{themes.filter((theme) => theme.role !== "MAIN" && !theme.processing).map((theme) => <option key={theme.id} value={theme.id}>{theme.name} · {theme.role}</option>)}</select></label></div> : <div className="inline-callout"><strong>No Shopify store connected yet.</strong><span>The URL-only research/creative pipeline can still run. Connect Shopify in Settings to complete the actual store build.</span></div>}<p className="tiny">When there is exactly one connected store, StoreForge selects it automatically. It prefers an unpublished theme with “Shrine” in the name and duplicates it before writing.</p></div></section>
      </>}

      {error && <div className="error-box">{error}</div>}
    </form>
  </>;
}
