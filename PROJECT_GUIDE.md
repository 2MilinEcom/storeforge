# StoreForge

StoreForge is a local-first Next.js application that can turn a single product/TikTok Shop URL into an unpublished conversion-focused one-product storefront. The URL is the primary input: StoreForge researches the SKU, extracts verifiable public pricing/variants, generates its own media-search terms, finds creator TikToks and exact-product references, retrieves relevant Reference Brain patterns, builds Shopify/Shrine, then visually audits and refines the result. Advanced inputs remain optional overrides.

The owner-mode UI is intentionally simple now, while the data model and boundaries are designed so the same workflow can become a multi-user SaaS later.

## What is built

### Conversion optimizer + visual QA loop

- A conversion-opportunity scan evaluates a broad product-page taxonomy before the theme is built: hero clarity, buy-box support, option guidance, UGC, mechanism, how-to, specifications, ingredients/materials, what is included, compatibility, care, safety, expectation setting, factual comparisons, source-backed proof, shipping/returns, guarantee, trust, FAQ, sticky ATC, AOV/bundles, subscription fit, final CTA, mobile rhythm, and page-speed tradeoffs.
- OpenAI web search can add category-specific decision aids and PDP modules that are not covered by the baseline taxonomy. StoreForge scores them and only includes modules that are relevant and supportable; missing merchant truths stay flagged instead of being invented.
- After Shopify renders the unpublished build, StoreForge opens the actual homepage and PDP in local Chrome/Chromium at desktop and mobile widths, saves four screenshots, and sends those renders to OpenAI vision for visual/conversion QA.
- The visual audit checks broken/error/password pages, media, cropping, hierarchy, CTA visibility, price/variant clarity, proof, copy density, spacing, mobile ergonomics, contrast/accessibility, trust, consistency, and unsupported visible claims.
- Safe auto-fixes can shorten/reorder copy, refine CTAs, adjust FAQs/comparison language, include/remove/reposition StoreForge optimizer modules, and make constrained presentation corrections such as section density, hero scale, image/video fit, and mobile UGC width. They cannot invent reviews, discounts, shipping, guarantees, scarcity, certifications, before/after outcomes, prices, or variant facts.
- StoreForge then rewrites the same unpublished theme and rerenders it. The loop stops when the QA target is met with no critical/major issue, or when the configurable hard pass cap is reached. The default is 90/100 with 4 passes (maximum 6) so a bad loop cannot spend indefinitely.
- The QA score is a design/completeness threshold, not a claim or prediction of real conversion rate.


### Automatic TikTok + product-media sourcing

- A new build is designed to start with only a product/TikTok Shop URL. The New Build screen is URL-first; everything else is under optional advanced overrides.
- Product name, public source price, legitimate source compare-at price, currency, variants, search phrases, creator media, product references, reference stores, copy, and PDP structure are derived automatically when verifiable.
- Supplier cost is never guessed from a retail TikTok page; it stays optional until you know it.
- Optional search terms such as `mature skin foundation`, `large pores makeup`, or `Korean makeup comparison` help StoreForge broaden its creator-video search.
- OpenAI web search discovers public TikTok post URLs and ranks varied direct-response angles instead of grabbing the first few results.
- TikTok oEmbed supplies creator/title/thumbnail metadata and StoreForge uses TikTok's official Embed Player URL as the attribution-safe storefront fallback.
- For deeper creative analysis, StoreForge attempts to download public posts locally with `yt-dlp`. If `yt-dlp` is not already installed, owner mode can bootstrap the official binary into `data/bin/` automatically.
- Downloaded creator posts go through the existing frame/transcription/clip-analysis pipeline. If a download is blocked, the build can continue with the official TikTok embed rather than stopping and asking for an MP4 upload.
- By default, discovered TikTok posts are **not re-hosted** in Shopify. The theme embeds the attributed TikTok player. A build-default toggle can allow cutting/re-hosting only when you have permission to reuse the discovered media.
- Product-reference images are also sourced automatically: StoreForge first inspects the supplied product URL, then searches for authoritative exact-SKU product pages and downloads usable reference photography.
- Auto-sourced product imagery is reference-only by default. StoreForge can use it to preserve physical product fidelity during image generation without automatically republishing retailer/manufacturer imagery as your storefront media.
- Three media modes are available per project: **Automatic**, **Automatic + mine**, and **Uploads only**.

### Product + creative intelligence

- Product/TikTok Shop URL research through the OpenAI Responses API with web search when configured.
- Optional reference/inspiration product page analysis for conversion structure and pacing — never for copying text or brand assets.
- Video pipeline using `ffmpeg` / `ffprobe`:
  - sampled frames
  - audio extraction and transcription
  - hook/angle/proof/objection analysis
  - normalized 8–20 second storefront clip recommendations
  - automatic short MP4 cuts
- Reference-guided product image generation.
- Second-pass product-fidelity review of generated creative; low-fidelity outputs are retried or rejected instead of automatically entering the store.
- Claim guardrails that separate visible creator proof from unverified factual claims.


### Reference Brain

- Bulk-learn up to 30 public ecommerce product-page URLs at a time from a new **Reference brain** screen.
- Each page is distilled into reusable conversion patterns: page sequence, hook style, offer presentation, proof placement, objection handling, visual rhythm, CTA repetition, trust design, and mobile behavior.
- StoreForge stores the URL plus structured lessons rather than a permanent copy of the source page.
- Automatic category discovery uses the OpenAI Responses API web-search tool to find relevant standalone DTC product pages when the local memory is thin.
- Every build retrieves several relevant references and combines their patterns with product research + UGC instead of cloning one store.
- Reference quality scores represent visible conversion-design completeness only; they are not claims about actual revenue or conversion rate.
- Exact source wording, brand assets, testimonials, proprietary graphics, and distinctive creative compositions are explicitly excluded from reuse.

### Shopify build engine

- Shopify OAuth with encrypted access-token storage.
- Shopify Admin GraphQL adapter targeting `2026-07` by default.
- Direct browser-to-Shopify staged uploads for large videos and theme ZIPs.
- One-time licensed Shrine/master-theme installer.
- Product creation/update with options, variants, price, legitimate compare-at price, SEO, and media. The custom PDP is written only into the duplicated unpublished theme’s default product template, avoiding a product-level template suffix that could affect the live theme.
- Product creation/update is separated from storefront publication. Online Store publication is held by default until you approve the unpublished theme; an owner setting can opt in to publication during builds.
- Theme duplication with processing polling. The master theme and live theme are never edited.
- Shrine-aware buy-box cleanup:
  - removes placeholder review/rating content
  - removes generic delivery checkpoints
  - removes default fake bundle UI when no discount is configured
  - adds concise benefit proof near the title
  - makes shade/option selection clearer
  - keeps Shrine's native product form, cart, sticky ATC, and variant mechanics
- Shrine settings cleanup in the duplicated theme:
  - disables fake cart countdown/progress defaults
  - disables generic search on the one-product build where the setting exists
  - removes Shrine footer branding where the setting exists
  - enables policy links where the setting exists
- Editable StoreForge theme sections for:
  - conversion homepage
  - vertical UGC proof rail
  - source-backed social proof
  - product-vs-alternative comparison
  - dynamically selected conversion-opportunity modules
  - long-form story / objection handling / FAQ
  - repeated CTA moments
- Rendered desktop/mobile storefront QA, automatic safe refinement passes, and Shopify preview tracking.

### Owner workflow

1. Settings → configure verified operational truths, pricing defaults, and Reference Brain behavior.
2. Open **Reference brain** and bulk-add stores you respect, or let StoreForge discover category references automatically.
3. Connect a Shopify store through OAuth.
4. Upload your licensed Shrine theme ZIP once as the unpublished master.
5. New Build → paste the product URL, optional creator-search terms, optional inspiration URL, product economics, and notes. Uploads are optional.
6. Choose **Automatic** to let StoreForge source TikTok creator posts and exact-SKU product references itself; use **Automatic + mine** if you also have owned UGC/product photos.
7. Select store + master theme and click **Create & build**.
8. StoreForge runs research → automatic media sourcing → video analysis → Reference Brain retrieval/discovery → strategy → conversion-opportunity scan → creative → Shopify product → theme copy/injection → UGC → rendered visual QA → safe refinement loop.
9. Public TikTok posts use the official attributed player by default. If you explicitly enable re-hosting for media you have rights to use, StoreForge can cut/upload those clips to Shopify instead.
10. Open **Preview Shopify**. Publishing the generated theme stays a deliberate merchant action.

## Local setup

Prerequisites:

- Node.js 22+
- `ffmpeg` and `ffprobe`
- `yt-dlp` is optional; StoreForge can bootstrap its official binary automatically for TikTok analysis downloads
- Shopify app credentials for live store building
- OpenAI API key for live AI analysis/generation

```bash
cp .env.example .env.local
npm run keygen
# Paste the generated value into APP_ENCRYPTION_KEY in .env.local
npm install
npm run doctor
npm run dev
```

Open `http://localhost:3000`.

`npm run doctor` checks Node, ffmpeg/ffprobe, TikTok media-downloader availability, the local data directory, whether Chrome/Chromium can be found for rendered visual QA, and whether live integration secrets are configured without printing them. If Chrome is installed somewhere unusual, set `CHROME_PATH` in `.env.local`.

## Shopify setup

See [`docs/SHOPIFY_SETUP.md`](docs/SHOPIFY_SETUP.md).

The OAuth redirect URL for local owner mode is:

```text
http://localhost:3000/api/shopify/oauth/callback
```

Theme-modifying public apps can require additional Shopify approval/exemption. StoreForge treats this as a future SaaS launch requirement rather than hiding it.

## OpenAI setup

Put your API key in `.env.local` as `OPENAI_API_KEY`. The app uses the Responses API for research/analysis, the transcription endpoint for creator audio, and image editing for product-guided creative. Models can be changed through environment variables without changing code.

## Build defaults and truthfulness

Settings includes merchant-controlled fields for:

- default cost markup
- compare-at planning multiplier (planning only; StoreForge never invents compare-at pricing)
- verified shipping copy
- verified return-policy summary
- support email
- permanent claim guardrails
- optional bundle-strategy recommendations
- whether product publication to the Online Store should happen during builds (off by default)
- whether Reference Brain is used on builds
- whether category references can be discovered automatically
- how many learned references are retrieved per build
- whether the conversion-opportunity scan runs
- whether rendered OpenAI visual QA runs
- whether safe QA fixes are automatically applied
- the visual-QA target score and maximum pass count
- whether TikTok creator videos are discovered automatically and how many to source
- whether exact-SKU product references are discovered automatically and how many to source
- whether discovered TikTok media may be re-hosted (off by default; only enable when you have reuse rights)

Operational fields are blank by default. If you do not provide a shipping promise, return promise, rating, testimonial, or legitimate compare-at price, StoreForge does not fabricate one. Product publication is also off by default, so a newly generated product cannot appear on the live storefront before you approve the unpublished theme.

## Owner-mode persistence

Projects, Reference Brain memory, and secrets currently use a local JSON repository under `data/`. Shopify tokens are AES-256-GCM encrypted using `APP_ENCRYPTION_KEY`.

A 32+ character `APP_ENCRYPTION_KEY` is required before StoreForge will start Shopify OAuth. Generate one with `npm run keygen`. Do not commit `.env.local` or `data/`.

## SaaS / Vercel later

The current UI already stores owner IDs, store connections, theme profiles, projects, assets, build steps, and build state separately. Before selling access, move persistence/media/jobs to production services and add real authentication, teams, billing, audit logs, and Shopify app lifecycle webhooks.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`docs/VERCEL_LATER.md`](docs/VERCEL_LATER.md).

Customer-event/checkout pixel installation and legal-policy authoring are intentionally not silently injected by owner mode. Those should become explicit Shopify app-extension / merchant-controlled workflows before StoreForge is sold to other merchants.

## Current local-build note

This source tree was statically checked in the build environment, the Shopify GraphQL operations were schema-validated, the generated Liquid schemas were JSON-validated, and ffmpeg/ffprobe prerequisites passed. The sandbox could not resolve `registry.npmjs.org` (`EAI_AGAIN`), so it could not complete a full `npm install` / Next.js production build here. Run `npm install && npm run typecheck && npm run build` on the machine where you launch StoreForge. Source checks, Shopify GraphQL schema validation, generated Liquid schema validation, and TypeScript/TSX syntax checks passed in this environment. A live headless-Chrome Shopify preview pass still needs to execute on the machine running StoreForge; `npm run doctor` verifies whether Chrome is discoverable there.
