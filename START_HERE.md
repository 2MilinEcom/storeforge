# Start StoreForge locally

StoreForge is already configured as a local-first Next.js owner app. Vercel is optional later.

## 1. Install prerequisites

You need:

- Node.js 22+
- ffmpeg + ffprobe
- Google Chrome or Chromium for rendered visual QA
- yt-dlp is optional; StoreForge can bootstrap it automatically when it first sources TikTok media
- an OpenAI API key
- Shopify app API key + secret

## 2. Configure the app

```bash
cp .env.example .env.local
npm run keygen
```

Paste the generated key into `APP_ENCRYPTION_KEY` in `.env.local`, then add your OpenAI and Shopify app credentials.

For local Shopify OAuth, set this allowed redirect URL in your Shopify app:

```text
http://localhost:3000/api/shopify/oauth/callback
```

## 3. Install and run

```bash
npm install
npm run doctor
npm run typecheck
npm run dev
```

Open:

```text
http://localhost:3000
```

## 4. One-time owner setup

Inside StoreForge:

1. Open **Settings**.
2. Connect your Shopify store.
3. Upload your licensed Shrine ZIP as the master theme.
4. Open **Reference brain** and paste any store/product pages whose conversion structure you like. You can add up to 30 URLs per batch.
5. In Settings, leave **Use Reference Brain**, **Auto-discover category references**, **Automatically discover TikTok videos**, and **Automatically discover product images** on for the full hands-off build.
6. Keep **Re-host discovered TikTok videos** off unless you have permission to reuse those specific creator videos. With it off, StoreForge uses TikTok’s official attributed player.
7. Enter only verified shipping / returns / operational promises.
8. Keep **Conversion opportunity scan**, **OpenAI visual QA**, and **Automatic safe QA fixes** enabled if you want the full optimizer loop. The default QA target is 90/100 with 4 passes.
9. Leave **Publish products during builds** off unless you explicitly want new generated products visible through the Online Store before theme approval.

## 5. Build a store

Click **New Build** and paste the **product / TikTok Shop URL**. That is the normal input. Press **Build store from URL**.

StoreForge then tries to derive the product name, current public price, legitimate compare-at price, variants, category, customer, TikTok search terms, creator videos, product-reference imagery, reference stores, copy, page modules, and Shopify/Shrine build automatically.

Use **Advanced overrides** only when you want to supply facts StoreForge cannot know (for example your supplier cost, special brand instructions, a specific inspiration store, owned media, or a different Shopify/theme destination). Supplier cost is never guessed from a retail product page.

StoreForge runs:

```text
Research -> automatic TikTok/product-media sourcing -> UGC analysis -> Reference Brain retrieval/discovery -> strategy -> conversion scan -> short clips / attributed embeds -> product-fidelity creative -> Shopify product -> Shrine duplicate -> homepage/PDP -> UGC -> rendered desktop/mobile QA -> safe retry loop -> preview
```

Manual media upload is no longer required in **Automatic** mode. If a public TikTok cannot be downloaded for deep analysis, StoreForge can still continue with the official TikTok Embed Player. Auto-sourced product images are reference-only by default and are used to create product-faithful original store imagery.

The generated Shopify theme remains unpublished. StoreForge visually audits and safely refines that unpublished preview before marking the build complete. Review the Shopify preview before publishing it yourself.

Chrome is auto-detected on normal macOS installs. If StoreForge cannot find it, add this to `.env.local`:

```text
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

## Later: Vercel / SaaS

See `ARCHITECTURE.md` and `docs/VERCEL_LATER.md`. The owner-mode repository, local media, and in-process worker are intentionally isolated so they can be replaced by Postgres, object storage, a durable queue, authentication, teams, and billing later without changing the basic build workflow.
