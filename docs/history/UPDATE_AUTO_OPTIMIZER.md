# StoreForge v0.5 Auto Optimizer update

This update is for an existing StoreForge v0.4 / Reference Brain installation. It preserves your `.env.local`, connected-store credentials, project data, and Reference Brain database.

## Install the patch

Stop StoreForge with `Ctrl+C`, then from your existing StoreForge directory run:

```bash
cd ~/Downloads/storeforge-next
unzip -o ~/Downloads/storeforge-auto-optimizer-update.zip
npm run check:source
npm run doctor
npm run typecheck
npm run dev
```

No new npm package is required.

Open `http://localhost:3000`, then go to **Settings → Auto optimizer**. The recommended defaults are:

- Conversion opportunity scan: ON
- Rendered visual QA: ON
- Automatic safe fixes: ON
- Target score: 90
- Max passes: 4

StoreForge will auto-detect normal Chrome/Chromium installations. If it cannot find Chrome on macOS, add the following to `.env.local` and restart:

```text
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

## What changes

A build now performs a category-wide product-page opportunity scan, renders the real unpublished Shopify homepage and PDP on desktop and mobile, has OpenAI vision audit the renders, applies only safe copy/structure fixes, rebuilds the same unpublished theme, and retries until the QA threshold is reached or the configured pass cap stops the loop.

The score is a visual/conversion-design QA threshold, not a prediction of actual conversion rate. StoreForge still refuses to invent reviews, discounts, shipping promises, guarantees, scarcity, medical claims, certifications, or other unsupported facts.
