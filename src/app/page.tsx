import Link from "next/link";
import { repo } from "@/lib/repository";
import { integrationStatus } from "@/lib/env";
import { StatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const projects = await repo.listProjects();
  const stores = await repo.listStores();
  const references = await repo.listReferences();
  const status = integrationStatus();
  const complete = projects.filter((p) => p.status === "complete").length;
  return <div className="page">
    <header className="page-head hero-head">
      <div><p className="eyebrow">DROPSHIP STORE OPERATING SYSTEM</p><h1>Turn product creative into a <span>finished Shopify store.</span></h1><p className="lede">Paste the product. Drop the videos. StoreForge researches, analyzes, creates, builds Shrine, and hands you a preview.</p></div>
      <Link className="button primary large" href="/new">+ New store build</Link>
    </header>
    <section className="metric-grid">
      <div className="metric"><span>Projects</span><strong>{projects.length}</strong><small>All builds</small></div>
      <div className="metric"><span>Ready</span><strong>{complete}</strong><small>Completed previews</small></div>
      <div className="metric"><span>Stores</span><strong>{stores.length}</strong><small>Connected Shopify stores</small></div>
      <div className="metric"><span>Brain</span><strong>{references.filter((r) => r.status === "ready").length}</strong><small>Learned reference pages</small></div>
      <div className="metric"><span>Engine</span><strong>{status.openai ? "AI ON" : "DEMO"}</strong><small>{status.openai ? "OpenAI connected" : "Add API key in .env"}</small></div>
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">BUILD QUEUE</p><h2>Your projects</h2></div><Link href="/new" className="text-link">Create build →</Link></div>
      {projects.length === 0 ? <div className="empty"><div className="empty-icon">✦</div><h3>No projects yet</h3><p>Your first build starts with a product URL, marketing videos, and product references.</p><Link href="/new" className="button primary">Create first project</Link></div> : <div className="project-list">
        {projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="project-row">
          <div className="project-title"><span className="project-icon">{project.research?.productName?.slice(0,1) || project.name.slice(0,1)}</span><div><strong>{project.research?.productName || project.name}</strong><small>{project.productUrl.replace(/^https?:\/\//, "").slice(0,72)}</small></div></div>
          <div className="project-meta"><span>{project.assets.filter((a) => a.kind === "video").length} videos</span><span>{project.assets.filter((a) => a.kind === "image").length} refs</span><StatusPill status={project.status} /></div>
        </Link>)}
      </div>}
    </section>
    <section className="integration-grid">
      <div className="panel compact"><p className="eyebrow">OPENAI</p><h3>{status.openai ? "Connected" : "Not configured"}</h3><p>{status.openai ? "Research, video analysis, transcription, and product-reference image generation are enabled." : "The UI works in demo mode. Add OPENAI_API_KEY to enable live intelligence."}</p></div>
      <div className="panel compact"><p className="eyebrow">SHOPIFY</p><h3>{stores.length ? `${stores.length} store${stores.length === 1 ? "" : "s"} connected` : "Connect a store"}</h3><p>OAuth connections are encrypted locally. StoreForge never asks you to paste an Admin token into the UI.</p><Link href="/settings" className="text-link">Manage Shopify →</Link></div>
      <div className="panel compact"><p className="eyebrow">REFERENCE BRAIN</p><h3>{references.length ? `${references.filter((r) => r.status === "ready").length} pages learned` : "Teach the builder"}</h3><p>Save conversion-oriented product pages and let StoreForge retrieve the most relevant structural patterns for future builds.</p><Link href="/references" className="text-link">Open Reference Brain →</Link></div>
    </section>
  </div>;
}
