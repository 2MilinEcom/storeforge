# StoreForge v0.7 — One-URL mode

The New Build screen is now centered on one input: the product/TikTok Shop URL.

## What is automatic

From that URL StoreForge now tries to derive or discover:

- product name and category
- current public selling price
- legitimate public compare-at/list price only when actually shown
- currency
- variants/options
- product facts, objections, safe claims and banned claims
- creator-video search terms
- public TikTok creator posts across multiple marketing angles
- exact-product reference photography
- relevant Reference Brain stores and additional category references
- marketing strategy, copy, page modules and imagery
- Shopify product + duplicated Shrine theme
- rendered desktop/mobile visual QA and retry loop

Supplier cost is not guessed from a retail listing. It remains an optional advanced override.

## Upgrade from any earlier StoreForge owner build

Stop the dev server with Ctrl+C, then from your existing `storeforge-next` folder unzip the cumulative update over the project. Your `.env.local` and `data/` folder are not included in the update package and remain untouched.

After upgrading run:

```bash
npm run check:source
npm run doctor
npm run typecheck
npm run dev
```

On the New Build page you should see **ONE-URL STORE BUILD** and a **Build store from URL** button. Everything else is under **Advanced overrides**.
