# StoreForge v0.6 — Automatic Media Sourcing

This is a cumulative update for the original StoreForge v0.3 folder. It also includes the Reference Brain and Auto Optimizer work from v0.4/v0.5.

## What changes

A new build can now start from a product/TikTok Shop URL plus optional creator-video search terms. Manual videos and product-reference uploads are optional.

StoreForge will:

1. research the product first;
2. use web search to discover relevant public TikTok post URLs;
3. enrich those posts with TikTok oEmbed metadata;
4. try to download selected posts locally with `yt-dlp` for transcription/frame analysis;
5. fall back to the official TikTok Embed Player if a post cannot be downloaded;
6. discover exact-product reference images from the supplied product page and authoritative matching pages;
7. treat auto-sourced product images as reference-only by default so they improve generated-image fidelity without automatically republishing third-party imagery;
8. continue through UGC analysis, Reference Brain, conversion planning, Shopify/Shrine build, and visual QA.

Discovered TikTok videos are not re-hosted by default. If you have commercial reuse rights, enable **Allow re-host discovered TikToks** in Settings. Otherwise StoreForge uses attributed TikTok embeds on the storefront.

## Update your existing Mac install

Stop the dev server with `Ctrl+C`, then run:

```bash
cd ~/Downloads/storeforge-next
unzip -o ~/Downloads/storeforge-v0.6-cumulative-update.zip
npm run check:source
npm run doctor
npm run typecheck
npm run dev
```

No new npm package dependencies were added, so an existing working v0.3 install should not need `npm install` again.

Open `http://localhost:3000` and go to **Settings**. Automatic TikTok discovery and automatic product-reference discovery are on by default.

## New build flow

Choose **Automatic** in the New Build wizard and provide:

- product or TikTok Shop URL;
- selling price / cost as needed;
- optional creator-video search terms such as `mature skin`, `large pores`, `first impression`, or `Korean makeup comparison`;
- Shopify store/theme selections when connected.

You do not need to upload creator videos or product images to start the build. You can still add your own files with **Automatic + mine** when you have first-party assets.

## Optional yt-dlp settings

StoreForge can bootstrap the official `yt-dlp` binary on the first automatic-media build. You can override that behavior in `.env.local`:

```text
AUTO_DOWNLOAD_YTDLP=true
YTDLP_PATH=
YTDLP_COOKIES_FROM_BROWSER=
```

`YTDLP_COOKIES_FROM_BROWSER` is intentionally blank by default. Only set it when you understand and accept the implications of giving a local downloader access to browser cookies.

## If a TikTok cannot be downloaded

The build does not have to stop. StoreForge keeps the public TikTok URL and official player URL, creates an external-video analysis placeholder, and can render that attributed embed in the UGC section.

## Safety defaults

- Third-party product images: reference-only unless you explicitly replace them with owned/licensed assets.
- Discovered TikTok videos: attributed embed by default, not re-hosted.
- Creator claims: treated as creator statements, not automatically promoted to verified product facts.
- Existing live Shopify theme: not modified by the build pipeline.
