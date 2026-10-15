# StoreForge architecture

## Current owner-mode stack

- **Frontend / API:** Next.js 16.3 App Router + TypeScript
- **Persistence:** local JSON repository (`src/lib/repository.ts`)
- **Project media:** local filesystem under `data/projects`
- **Long-running work:** in-process owner-mode build runner
- **Video processing:** ffmpeg / ffprobe
- **AI:** OpenAI Responses API, transcription, reference-guided image editing
- **Commerce:** Shopify Admin GraphQL (default API version `2026-07`)
- **Theme safety:** duplicate an installed master, preserve/enhance its main product section, inject StoreForge sections, never auto-publish the theme

## Core entities

- `User`
- `StoreConnection`
- `ThemeProfile`
- `Project`
- `AssetRef`
- `ProductResearch`
- `VideoAnalysis`
- `MarketingStrategy`
- `BuildStep`
- `BuildDefaults`
- `ReferenceStore`
- `ReferenceAnalysis`
- `ReferenceMemoryUse`
- `ConversionOpportunityPlan` / `ConversionModule`
- `VisualQaReport` / `VisualQaIssue`

Owner IDs already exist so the API/UI contracts do not need to be reinvented when authentication and organizations are added.

## Build pipeline

`URL intake → Research/autofill → Automatic media discovery → Video analysis → Reference Brain retrieval/discovery → Strategy → Conversion opportunity scan → Creative → Shopify product → Theme duplicate/injection → UGC integration → Rendered visual QA → Safe refinement loop`

The default intake is intentionally one-field: a product/TikTok Shop URL. Advanced form controls only override the autonomous intake. If exactly one Shopify store is connected, StoreForge selects it automatically; after themes load it prefers an unpublished theme whose name contains `Shrine`.

Each step is persisted so the project page can show waiting, running, done, blocked, or failed states.

### Research

The supplied product page is fetched best-effort and combined with OpenAI web research when enabled. An optional inspiration URL is analyzed for information hierarchy and conversion pacing only. The strategy prompt explicitly prohibits copying brand text, testimonials, or distinctive creative from the inspiration site.

### Reference Brain

Reference Brain is a persistent, structured pattern library. Manual URLs and auto-discovered public DTC product pages are analyzed into abstract reusable signals rather than stored as copied page text. A reference stores category/product-type metadata, visible conversion-design score, page sequence, hook/offer/proof/objection/visual/mobile/CTA/trust patterns, strengths, weaknesses, transferable lessons, and source-specific elements that should not be copied.

At build time StoreForge scores learned references against the researched product category, features, audience, and product name. It retrieves several relevant references. If the relevant library is too thin and auto-discovery is enabled, one web-search pass can discover a few additional product pages and learn them before strategy synthesis. The final strategy receives multiple distilled references so the model can combine patterns instead of cloning one site.

The local owner build uses structured retrieval rather than a vector database. When the SaaS moves to Postgres, `reference_stores` and `reference_analyses` can add embeddings/pgvector without changing the UI or build contract.

### Video analysis

Each creator video is sampled across its duration, audio is transcribed, and the AI identifies the hook, angle, visible proof, objection handling, claim risks, and best storefront placement. StoreForge cuts the strongest recommended short window with ffmpeg.

Generated clip assets keep stable IDs across rebuilds so a browser-direct Shopify upload is not lost when the user rebuilds the theme.


### Conversion opportunity scan

Before theme generation, StoreForge evaluates a broad built-in PDP taxonomy and can use web search to find category-specific additions. Every proposed module is classified as `include`, `needs_input`, or `skip`, with evidence state, confidence, impact potential, placement, and merchant questions. This makes the search space broad without turning every page into an indiscriminate long-form catalog.

Only `include` modules render. Operational or proof-heavy modules that require merchant truth remain `needs_input`; misleading ideas are `skip`. Included modules render through a generic editable `storeforge-opportunities` Liquid section and can be placed after UGC, mid-page, or before FAQ.

### Rendered visual QA and self-refinement

After the unpublished Shopify theme exists, StoreForge uses local Chrome/Chromium to render four views: homepage desktop, homepage mobile, PDP desktop, and PDP mobile. OpenAI vision audits what actually rendered, not just the intended code.

A build passes only when the configured score threshold is met and no critical/major issue remains. If safe, auto-fixable issues exist, StoreForge asks the model for a restricted patch, updates strategy/module settings, rewrites the same unpublished theme, waits briefly for propagation, rerenders, and audits again.

Automatic patches are intentionally constrained to supported copy/structure plus a small presentation vocabulary (section density, hero scale, media fit, mobile UGC width). They cannot add factual claims, fake social proof, operational promises, discounts, scarcity, guarantees, prices, variant facts, certifications, or before/after outcomes. The loop has a configurable hard pass cap (default 4, maximum 6) to prevent runaway cost or an infinite optimizer loop.

The QA score is an internal visual/conversion-design completeness score, not measured conversion performance.

### Creative fidelity

Image generation always starts from a real uploaded product reference. A second vision pass compares the generated product against the reference. Major geometry, packaging, applicator, color, or branding drift triggers a retry; persistent low-fidelity outputs are rejected instead of added to the store.

### Automatic product + creator media sourcing

A project can run in `auto`, `auto_plus_uploads`, or `uploads` media mode. In automatic modes, product research runs before creative ingestion so the discovery layer can use the exact product name, category, benefits, features, supplied product URL, and owner-entered creator search terms.

For public TikTok creator content, StoreForge discovers post URLs with web search, resolves creator/title/thumbnail metadata with TikTok oEmbed, and attempts a local `yt-dlp` copy only for analysis. If local retrieval fails, the project retains the official TikTok player URL as a storefront-safe attributed embed fallback. Discovered videos are non-publishable by default; the owner must explicitly enable re-hosting when they have reuse rights.

For product photography, StoreForge parses the supplied product page and authoritative exact-SKU pages for reference imagery. These assets are stored as non-publishable references by default and are intended to improve physical-product fidelity during generated creative production rather than to silently republish retailer/manufacturer media.

### Shopify media

Small/normal server-side uploads use Shopify staged uploads. Large-video failure has a browser-direct path:

`StoreForge requests signed staged target → browser POSTs bytes directly to Shopify storage → StoreForge calls fileCreate → StoreForge polls processing → final CDN URL is saved on the asset.`

This specifically removes the raw-MP4 transfer limitation encountered in chat/server environments.

### Product creation

StoreForge uses `productSet` so title, description, SEO, product options, variants, prices, and media can be set consistently. StoreForge writes its custom `templates/product.json` only into the duplicated unpublished theme, so it does not need to set a product-level template suffix that could alter rendering on the current live theme. Online Store publication is held by default so a generated product cannot surface on the live storefront before the unpublished theme is reviewed. Owner settings can explicitly opt in to publication during builds; publication failures are surfaced rather than hidden.

Compare-at prices are accepted only when the merchant supplied them and they are higher than the selling price. The default markup can infer a selling price from cost, but StoreForge does not fabricate an original/compare-at price.

### Theme build

The selected master is duplicated first and StoreForge polls until Shopify finishes processing the copy. It reads the base product template and preserves the main product section so the theme's cart and product mechanics remain native.

For Shrine-like product templates, the adapter removes obvious placeholders and fake defaults, improves option/ATC presentation, and adds a compact benefit block above the fold. It then adds editable StoreForge homepage/PDP/UGC/proof/comparison/optimizer/FAQ sections to the unpublished copy.

When the duplicate contains Shrine-style global settings, StoreForge disables the default countdown/free-shipping style cart messaging and removes theme branding only inside the duplicated theme.

## Truth and operational settings

`BuildDefaults` stores only merchant-authorized operational copy. Shipping/returns/support text is inserted only when explicitly configured. Social proof is emitted only when source-backed; otherwise the proof section states that no unverified testimonials are shown.

## Production boundaries

### Repository

Replace `src/lib/repository.ts` with Postgres. Recommended tables:

- users
- organizations
- memberships
- store_connections
- theme_profiles
- build_defaults
- projects
- project_assets
- video_analyses
- marketing_strategies
- build_jobs
- build_steps
- usage_events
- audit_events
- reference_stores
- reference_analyses
- reference_usage

### Files

Replace local media with S3/R2/Vercel Blob or equivalent. Store object keys in the database, not raw bytes.

### Build queue

Move `runBuild()` to a durable worker/queue so video/image work survives process restarts and does not depend on serverless request limits. The current UI can keep polling the same persisted build-step records.

### Authentication and tenancy

Owner mode uses a fixed local owner. Before external users:

- production auth
- organizations/teams
- row-level authorization on every store/project/theme/asset request
- secret rotation and managed secret storage
- data export/deletion flows
- audit logs

### Shopify public app lifecycle

Before selling StoreForge:

- complete public-app review requirements
- obtain any required theme-write approval/exemption
- add app-uninstalled and privacy/compliance webhooks
- revoke/delete store credentials on uninstall
- add rate-limit aware retries and idempotency for long builds

### Tracking and legal operations

Owner mode does not silently install customer-event/checkout pixels or overwrite legal policies. Before external launch, implement tracking through the appropriate Shopify app-extension/event surfaces and make legal-policy changes an explicit merchant-controlled action with the required scopes.

### Billing

Meter expensive operations separately: video minutes, transcription, AI research, image generations, Shopify builds, and storage. Billing should sit outside the build engine so owner mode remains unchanged.
