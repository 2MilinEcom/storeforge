"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReferenceStore } from "@/lib/types";

function splitUrls(value: string) {
  return [...new Set(value.split(/[\n,\s]+/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x)))];
}

export function ReferenceBrainView() {
  const [references, setReferences] = useState<ReferenceStore[]>([]);
  const [urls, setUrls] = useState("");
  const [categoryHint, setCategoryHint] = useState("");
  const [notes, setNotes] = useState("");
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverLimit, setDiscoverLimit] = useState(5);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/references", { cache: "no-store" });
    if (response.ok) setReferences(await response.json());
  }

  useEffect(() => { void load(); }, []);

  const metrics = useMemo(() => {
    const ready = references.filter((r) => r.status === "ready");
    return {
      total: references.length,
      ready: ready.length,
      manual: ready.filter((r) => r.source === "manual").length,
      discovered: ready.filter((r) => r.source === "discovered").length,
      categories: new Set(ready.map((r) => r.analysis?.category).filter(Boolean)).size,
    };
  }, [references]);

  async function learn(event: React.FormEvent) {
    event.preventDefault();
    const parsed = splitUrls(urls);
    if (!parsed.length) { setError("Paste at least one full http/https store URL."); return; }
    setBusy(true); setError(""); setMessage(`Learning from ${parsed.length} store${parsed.length === 1 ? "" : "s"}…`);
    try {
      const response = await fetch("/api/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: parsed, categoryHint: categoryHint || undefined, notes: notes || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not learn references");
      setMessage(`Learned ${data.count} reference${data.count === 1 ? "" : "s"}. The source copy was distilled into reusable patterns.`);
      setUrls("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessage("");
    } finally { setBusy(false); }
  }

  async function discover(event: React.FormEvent) {
    event.preventDefault();
    if (!discoverQuery.trim()) return;
    setBusy(true); setError(""); setMessage("Searching for relevant DTC product-page references and learning the useful patterns…");
    try {
      const response = await fetch("/api/references/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: discoverQuery.trim(), limit: discoverLimit }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not discover references");
      setMessage(`Discovered and analyzed ${data.references?.length || 0} reference store${data.references?.length === 1 ? "" : "s"}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessage("");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    const response = await fetch(`/api/references/${id}`, { method: "DELETE" });
    if (response.ok) await load();
  }

  async function relearn(id: string) {
    setBusy(true); setError(""); setMessage("Re-learning that store from its current public page…");
    try {
      const response = await fetch(`/api/references/${id}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not re-learn reference");
      setMessage("Reference refreshed.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return <>
    <header className="page-head">
      <div>
        <p className="eyebrow">REFERENCE BRAIN</p>
        <h1>Teach StoreForge what <span>good selling pages do.</span></h1>
        <p className="lede">Drop in stores you respect. StoreForge distills their conversion structure into reusable memory, then retrieves the most relevant patterns for each future product.</p>
      </div>
    </header>

    <section className="metric-grid brain-metrics">
      <div className="metric"><span>Memory</span><strong>{metrics.ready}</strong><small>Learned store pages</small></div>
      <div className="metric"><span>Manual</span><strong>{metrics.manual}</strong><small>References you supplied</small></div>
      <div className="metric"><span>Discovered</span><strong>{metrics.discovered}</strong><small>Found automatically</small></div>
      <div className="metric"><span>Categories</span><strong>{metrics.categories}</strong><small>Product-page pattern groups</small></div>
    </section>

    <section className="content-grid reference-actions">
      <form className="panel" onSubmit={learn}>
        <p className="eyebrow">BULK LEARN</p>
        <h2>Paste a pile of store links.</h2>
        <p className="muted">One per line is easiest. Up to 30 per batch. StoreForge keeps the URL and distilled patterns — not a permanent copy of the source page. Large batches use one analysis call per page and can take a few minutes.</p>
        <label>Store / product page URLs<textarea rows={9} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder={"https://brand-one.com/products/product\nhttps://brand-two.com/products/product\nhttps://brand-three.com/products/product"}/></label>
        <div className="form-grid two">
          <label>Category hint <span className="muted">optional</span><input value={categoryHint} onChange={(e) => setCategoryHint(e.target.value)} placeholder="Beauty / foundation"/></label>
          <label>What you like about them <span className="muted">optional</span><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Strong mobile flow, visual proof, clean buy box"/></label>
        </div>
        <button className="button primary" disabled={busy || !splitUrls(urls).length}>{busy ? "Learning…" : `Learn ${splitUrls(urls).length || ""} link${splitUrls(urls).length === 1 ? "" : "s"} →`}</button>
      </form>

      <form className="panel" onSubmit={discover}>
        <p className="eyebrow">AUTO DISCOVERY</p>
        <h2>Let the AI scout the category.</h2>
        <p className="muted">StoreForge uses web search to find public standalone DTC product pages with relevant visible conversion patterns. It excludes marketplaces and does not assume a store is actually profitable.</p>
        <label>Product type / category<input value={discoverQuery} onChange={(e) => setDiscoverQuery(e.target.value)} placeholder="Color-changing foundation for mature skin"/></label>
        <label>How many references<select value={discoverLimit} onChange={(e) => setDiscoverLimit(Number(e.target.value))}>{[3,4,5,6,8].map((n) => <option value={n} key={n}>{n}</option>)}</select></label>
        <div className="inline-callout"><strong>Automatic on builds.</strong><span>When enabled in Settings, each build first retrieves relevant learned references. If the brain is thin for that category, it can discover a few new ones automatically.</span></div>
        <button className="button primary" disabled={busy || !discoverQuery.trim()}>{busy ? "Searching…" : "Discover & learn →"}</button>
      </form>
    </section>

    {error && <div className="error-box">{error}</div>}
    {message && <p className="notice brain-notice">{message}</p>}

    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">LEARNED LIBRARY</p><h2>{metrics.ready ? "Reusable conversion patterns" : "Your memory is empty"}</h2></div></div>
      {!references.length ? <div className="empty"><div className="empty-icon">◎</div><h3>Add your first references</h3><p>Feed StoreForge stores whose structure you like, or let it discover references for a category.</p></div> : <div className="reference-grid">
        {references.map((reference) => <article className={`reference-card ${reference.status}`} key={reference.id}>
          <div className="reference-top"><div><span className={`source-badge ${reference.source}`}>{reference.source}</span><strong>{reference.title || reference.domain}</strong><a href={reference.url} target="_blank" rel="noreferrer">{reference.domain} ↗</a></div><div className="reference-score"><b>{reference.analysis?.qualityScore?.toFixed(1) || "—"}</b><small>design<br/>score</small></div></div>
          {reference.status === "failed" ? <p className="reference-error">{reference.error || "Learning failed"}</p> : reference.status === "learning" ? <p className="muted">Learning page structure…</p> : <>
            <p className="reference-archetype">{reference.analysis?.archetype}</p>
            <div className="chip-row compact-chips">{[reference.analysis?.category, ...(reference.analysis?.productTypes || [])].filter(Boolean).slice(0,4).map((x) => <span className="chip" key={String(x)}>{x}</span>)}</div>
            <h3>Page sequence</h3><p className="sequence-line">{reference.analysis?.pageSequence.slice(0,7).join(" → ")}</p>
            <h3>Transferable lessons</h3><ul className="clean-list">{reference.analysis?.transferableLessons.slice(0,3).map((x) => <li key={x}>{x}</li>)}</ul>
          </>}
          <div className="reference-actions-row"><button type="button" className="button mini" onClick={() => relearn(reference.id)} disabled={busy}>Refresh</button><button type="button" className="button mini danger" onClick={() => remove(reference.id)} disabled={busy}>Remove</button></div>
        </article>)}
      </div>}
    </section>

    <section className="panel compact brain-policy">
      <p className="eyebrow">HOW MEMORY IS USED</p>
      <p>StoreForge retrieves several relevant references and combines their <strong>patterns</strong> with product research and UGC evidence. It is instructed not to clone a single site, reproduce source copy, steal testimonials, or reuse brand assets. The memory should make the page smarter without making it a copy.</p>
    </section>
  </>;
}
