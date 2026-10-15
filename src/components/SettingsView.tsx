"use client";

import { useEffect, useState } from "react";

type Store = { id: string; displayName: string; shop: string; scopes: string[] };
type Profile = { id: string; name: string; shopifyThemeId?: string; notes?: string };
type BuildDefaults = {
  defaultCurrency: string;
  defaultMarkupMultiplier: number;
  defaultCompareAtMultiplier: number;
  enableBundleRecommendations: boolean;
  publishProductDuringBuild: boolean;
  shippingPromise: string;
  returnPolicySummary: string;
  supportEmail: string;
  claimGuardrails: string;
  useReferenceBrain: boolean;
  autoDiscoverReferences: boolean;
  referenceCountPerBuild: number;
  enableConversionOpportunityScan: boolean;
  enableVisualQa: boolean;
  autoApplyVisualQaFixes: boolean;
  visualQaTargetScore: number;
  visualQaMaxPasses: number;
  autoDiscoverTikTokVideos: boolean;
  autoTikTokVideoCount: number;
  autoDiscoverProductImages: boolean;
  autoProductImageCount: number;
  allowRehostDiscoveredVideos: boolean;
};

export function SettingsView() {
  const [stores, setStores] = useState<Store[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [status, setStatus] = useState<any>({});
  const [defaults, setDefaults] = useState<BuildDefaults | null>(null);
  const [storeId, setStoreId] = useState("");
  const [zip, setZip] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [defaultsMessage, setDefaultsMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [s, p, i, d] = await Promise.all([
      fetch("/api/shopify/stores").then((r) => r.json()),
      fetch("/api/theme-profiles").then((r) => r.json()),
      fetch("/api/status").then((r) => r.json()),
      fetch("/api/build-settings").then((r) => r.json()),
    ]);
    setStores(Array.isArray(s) ? s : []);
    setProfiles(Array.isArray(p) ? p : []);
    setStatus(i);
    setDefaults(d);
    if (!storeId && s?.[0]?.id) setStoreId(s[0].id);
  }

  useEffect(() => { void load(); }, []);

  function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const shop = String(form.get("shop") || "");
    window.location.href = `/api/shopify/oauth/start?shop=${encodeURIComponent(shop)}`;
  }

  async function importTheme() {
    if (!storeId || !zip) return;
    setBusy(true);
    setMessage("Staging Shrine theme…");
    try {
      const stageResponse = await fetch("/api/shopify/uploads/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, resource: "FILE", filename: zip.name, mimeType: zip.type || "application/zip" }),
      });
      const stage = await stageResponse.json();
      if (!stageResponse.ok) throw new Error(stage.error || "Could not stage theme");
      const form = new FormData();
      for (const parameter of stage.parameters || []) form.append(parameter.name, parameter.value);
      form.append("file", zip);
      setMessage("Uploading Shrine directly to Shopify…");
      const upload = await fetch(stage.url, { method: "POST", body: form });
      if (!upload.ok) throw new Error(`Theme upload failed (${upload.status})`);
      setMessage("Installing unpublished master theme…");
      const completeResponse = await fetch("/api/shopify/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, kind: "theme", resourceUrl: stage.resourceUrl, filename: zip.name, themeName: `StoreForge Master - ${zip.name.replace(/\.zip$/i, "")}` }),
      });
      const complete = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(complete.error || "Could not install theme");
      setMessage(`Installed ${complete.name} as an unpublished master theme.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveDefaults(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!defaults) return;
    setDefaultsMessage("Saving…");
    const response = await fetch("/api/build-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaults),
    });
    const data = await response.json();
    if (!response.ok) setDefaultsMessage(data.error || "Could not save defaults");
    else { setDefaults(data); setDefaultsMessage("Defaults saved."); }
  }

  return <>
    <header className="page-head">
      <div>
        <p className="eyebrow">SETTINGS</p>
        <h1>Connect the engines once.</h1>
        <p className="lede">StoreForge saves your store connection, clean master theme, and operational truths so every future build starts from the same standard.</p>
      </div>
    </header>

    <section className="content-grid">
      <div className="panel">
        <p className="eyebrow">SHOPIFY OAUTH</p>
        <h2>Connected stores</h2>
        {stores.length ? <div className="connection-list">{stores.map((store) => <div className="connection" key={store.id}><span className="dot live"/><div><strong>{store.displayName}</strong><small>{store.shop}</small></div></div>)}</div> : <p className="muted">No Shopify stores connected yet.</p>}
        <form onSubmit={connect} className="connect-form">
          <label>Shopify domain<input name="shop" placeholder="your-store.myshopify.com" required /></label>
          <button className="button primary" disabled={!status.shopify}>Connect Shopify</button>
        </form>
        {!status.shopify && <div className="inline-callout"><strong>Shopify app credentials required.</strong><span>Add SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and a 32+ character APP_ENCRYPTION_KEY to .env.local first.</span></div>}
      </div>

      <div className="panel">
        <p className="eyebrow">OPENAI</p>
        <h2>{status.openai ? "AI engine connected" : "AI engine not configured"}</h2>
        <p>{status.openai ? "Research, transcription, frame analysis, conversion copy, and reference-guided image generation are available." : "Add OPENAI_API_KEY to .env.local. StoreForge stays usable in demo mode until then."}</p>
        <div className="connection"><span className={`dot ${status.openai ? "live" : ""}`}/><div><strong>{status.openai ? "Ready" : "Demo mode"}</strong><small>Responses API + transcription + image generation</small></div></div>
      </div>
    </section>

    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">MASTER THEME</p><h2>Install Shrine once</h2><p className="muted">StoreForge duplicates this master for every build, preserving the clean original and your live theme.</p></div></div>
      <div className="form-grid two">
        <label>Destination store<select value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="">Choose store</option>{stores.map((store) => <option value={store.id} key={store.id}>{store.displayName}</option>)}</select></label>
        <label>Theme ZIP<input type="file" accept=".zip,application/zip" onChange={(event) => setZip(event.target.files?.[0] || null)}/></label>
      </div>
      <button className="button primary" onClick={importTheme} disabled={!storeId || !zip || busy}>{busy ? "Installing…" : "Upload & install unpublished master"}</button>
      {message && <p className="notice">{message}</p>}
      {profiles.length > 0 && <div className="profile-list">{profiles.map((profile) => <div className="profile-card" key={profile.id}><strong>{profile.name}</strong><small>{profile.shopifyThemeId || "Theme ID pending"}</small></div>)}</div>}
      <div className="inline-callout"><strong>Public SaaS note.</strong><span>Shopify theme write APIs require the appropriate theme access and, for a public app, Shopify’s theme-modification approval/exemption. Internal owner-mode can be developed now.</span></div>
    </section>

    {defaults && <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">BUILD DEFAULTS</p><h2>Set truths once. Never let the builder guess them.</h2><p className="muted">Blank operational fields stay blank on future stores. StoreForge will not manufacture shipping promises, return guarantees, or unsupported claims.</p></div></div>
      <form onSubmit={saveDefaults}>
        <div className="form-grid three">
          <label>Default currency<input value={defaults.defaultCurrency} maxLength={3} onChange={(event) => setDefaults({ ...defaults, defaultCurrency: event.target.value.toUpperCase() })}/></label>
          <label>Price markup from cost<input type="number" min="1" max="20" step="0.1" value={defaults.defaultMarkupMultiplier} onChange={(event) => setDefaults({ ...defaults, defaultMarkupMultiplier: Number(event.target.value) })}/></label>
          <label>Compare-at planning multiplier<input type="number" min="1" max="10" step="0.1" value={defaults.defaultCompareAtMultiplier} onChange={(event) => setDefaults({ ...defaults, defaultCompareAtMultiplier: Number(event.target.value) })}/><span className="tiny">Planning only. StoreForge never auto-creates a sale/compare-at price from this.</span></label>
        </div>
        <div className="form-grid two">
          <label>Verified shipping promise<textarea rows={3} value={defaults.shippingPromise} placeholder="Example: Ships in 1–2 business days — only enter this if it is actually true." onChange={(event) => setDefaults({ ...defaults, shippingPromise: event.target.value })}/></label>
          <label>Verified returns summary<textarea rows={3} value={defaults.returnPolicySummary} placeholder="Example: 30-day returns — only enter your real policy." onChange={(event) => setDefaults({ ...defaults, returnPolicySummary: event.target.value })}/></label>
        </div>
        <div className="form-grid two">
          <label>Support email<input type="email" value={defaults.supportEmail} placeholder="support@yourbrand.com" onChange={(event) => setDefaults({ ...defaults, supportEmail: event.target.value })}/></label>
          <div><label className="check-row"><input type="checkbox" checked={defaults.enableBundleRecommendations} onChange={(event) => setDefaults({ ...defaults, enableBundleRecommendations: event.target.checked })}/><span>Let strategy recommend bundles when margins support it. StoreForge will not create a discount unless you explicitly configure one.</span></label><label className="check-row"><input type="checkbox" checked={defaults.publishProductDuringBuild} onChange={(event) => setDefaults({ ...defaults, publishProductDuringBuild: event.target.checked })}/><span>Publish products to the Online Store during builds. Off by default so a generated product cannot appear on the live storefront before you approve the unpublished theme.</span></label></div>
        </div>
        <div className="reference-defaults">
          <p className="eyebrow">REFERENCE BRAIN</p>
          <div className="form-grid two">
            <div>
              <label className="check-row"><input type="checkbox" checked={defaults.useReferenceBrain} onChange={(event) => setDefaults({ ...defaults, useReferenceBrain: event.target.checked })}/><span>Use learned store patterns when generating strategy and page structure.</span></label>
              <label className="check-row"><input type="checkbox" checked={defaults.autoDiscoverReferences} disabled={!defaults.useReferenceBrain} onChange={(event) => setDefaults({ ...defaults, autoDiscoverReferences: event.target.checked })}/><span>If memory is thin for a category, use web search to discover a few relevant DTC product pages automatically.</span></label>
            </div>
            <label>References retrieved per build<select value={defaults.referenceCountPerBuild} disabled={!defaults.useReferenceBrain} onChange={(event) => setDefaults({ ...defaults, referenceCountPerBuild: Number(event.target.value) })}>{[2,3,4,5,6,8,10].map((n) => <option value={n} key={n}>{n}</option>)}</select><span className="tiny">StoreForge combines patterns from several references instead of cloning one page.</span></label>
          </div>
        </div>
        <div className="reference-defaults">
          <p className="eyebrow">AUTO MEDIA SOURCING</p>
          <div className="form-grid two">
            <div>
              <label className="check-row"><input type="checkbox" checked={defaults.autoDiscoverTikTokVideos} onChange={(event) => setDefaults({ ...defaults, autoDiscoverTikTokVideos: event.target.checked })}/><span>Automatically search the web for public TikTok creator posts that match the product and project search terms.</span></label>
              <label className="check-row"><input type="checkbox" checked={defaults.autoDiscoverProductImages} onChange={(event) => setDefaults({ ...defaults, autoDiscoverProductImages: event.target.checked })}/><span>Automatically collect exact-SKU product-reference images from the product URL and authoritative matching product pages.</span></label>
              <label className="check-row"><input type="checkbox" checked={defaults.allowRehostDiscoveredVideos} disabled={!defaults.autoDiscoverTikTokVideos} onChange={(event) => setDefaults({ ...defaults, allowRehostDiscoveredVideos: event.target.checked })}/><span>Allow discovered TikTok videos to be cut and re-hosted in Shopify. Leave this off unless you have the rights to reuse those videos; StoreForge otherwise uses the official TikTok embed.</span></label>
            </div>
            <div className="form-grid two">
              <label>Creator videos per build<select value={defaults.autoTikTokVideoCount} disabled={!defaults.autoDiscoverTikTokVideos} onChange={(event) => setDefaults({ ...defaults, autoTikTokVideoCount: Number(event.target.value) })}>{[3,4,5,6,8,10].map((n) => <option value={n} key={n}>{n}</option>)}</select><span className="tiny">StoreForge searches for multiple angles, not just the first results it sees.</span></label>
              <label>Product references per build<select value={defaults.autoProductImageCount} disabled={!defaults.autoDiscoverProductImages} onChange={(event) => setDefaults({ ...defaults, autoProductImageCount: Number(event.target.value) })}>{[3,4,5,6,8,10,12].map((n) => <option value={n} key={n}>{n}</option>)}</select><span className="tiny">Auto-sourced images are reference-only by default; generated product photography can use them without republishing retailer imagery.</span></label>
            </div>
          </div>
        </div>
        <div className="reference-defaults">
          <p className="eyebrow">AUTO OPTIMIZER</p>
          <div className="form-grid two">
            <div>
              <label className="check-row"><input type="checkbox" checked={defaults.enableConversionOpportunityScan} onChange={(event) => setDefaults({ ...defaults, enableConversionOpportunityScan: event.target.checked })}/><span>Scan the product category for every useful PDP addition, decision aid, trust element, education module, and objection-reducer before building.</span></label>
              <label className="check-row"><input type="checkbox" checked={defaults.enableVisualQa} onChange={(event) => setDefaults({ ...defaults, enableVisualQa: event.target.checked })}/><span>After Shopify is built, use Chrome + OpenAI vision to inspect desktop and mobile homepage/PDP screenshots.</span></label>
              <label className="check-row"><input type="checkbox" checked={defaults.autoApplyVisualQaFixes} disabled={!defaults.enableVisualQa} onChange={(event) => setDefaults({ ...defaults, autoApplyVisualQaFixes: event.target.checked })}/><span>Automatically apply safe copy/structure fixes and re-check until the target score is reached or the pass limit is hit.</span></label>
            </div>
            <div className="form-grid two">
              <label>Visual QA target<select value={defaults.visualQaTargetScore} disabled={!defaults.enableVisualQa} onChange={(event) => setDefaults({ ...defaults, visualQaTargetScore: Number(event.target.value) })}>{[80,85,88,90,92,95].map((n) => <option value={n} key={n}>{n}/100</option>)}</select><span className="tiny">This is a design/QA threshold, not a predicted conversion rate.</span></label>
              <label>Maximum refinement passes<select value={defaults.visualQaMaxPasses} disabled={!defaults.enableVisualQa || !defaults.autoApplyVisualQaFixes} onChange={(event) => setDefaults({ ...defaults, visualQaMaxPasses: Number(event.target.value) })}>{[1,2,3,4,5,6].map((n) => <option value={n} key={n}>{n}</option>)}</select><span className="tiny">A hard cap prevents runaway API cost or endless loops.</span></label>
            </div>
          </div>
        </div>
        <label>Permanent claim guardrails<textarea rows={4} value={defaults.claimGuardrails} onChange={(event) => setDefaults({ ...defaults, claimGuardrails: event.target.value })}/></label>
        <div className="settings-actions"><button className="button primary">Save build defaults</button>{defaultsMessage && <span className="notice inline-notice">{defaultsMessage}</span>}</div>
      </form>
    </section>}
  </>;
}
