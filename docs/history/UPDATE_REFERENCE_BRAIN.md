# Upgrade an existing StoreForge install to Reference Brain v0.4

This update does not add npm dependencies and does not overwrite `.env.local` or `data/storeforge.json`.

1. Stop the running StoreForge dev server with `Ctrl+C` in the terminal where `npm run dev` is running.
2. Download `storeforge-reference-brain-update.zip` to your Downloads folder.
3. Run:

```bash
cd ~/Downloads/storeforge-next
unzip -o ~/Downloads/storeforge-reference-brain-update.zip
npm run check:source
npm run typecheck
npm run dev
```

4. Refresh `http://localhost:3000`.
5. A new **Reference brain** item appears in the left sidebar.

Inside Reference Brain you can:

- paste up to 30 store/product-page URLs per batch
- optionally label them by category
- let StoreForge auto-discover relevant standalone DTC product pages by category
- refresh or remove learned references

By default, future builds retrieve up to 6 relevant learned references. If fewer than 3 relevant references exist and auto-discovery is enabled, StoreForge can scout and learn a few more before creating the strategy.

Reference Brain stores distilled conversion patterns rather than a permanent copy of source-page text. It is instructed not to reproduce source wording, testimonials, brand assets, or distinctive creative expression.
