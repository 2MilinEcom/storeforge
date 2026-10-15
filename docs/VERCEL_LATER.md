# Moving StoreForge to Vercel later

The current app is intentionally owner-mode and local-first. The Next.js UI/API does not depend on Vercel-specific services.

Before a Vercel production launch:

1. Replace the local JSON repository with Postgres.
2. Replace local project media with object storage such as S3, R2, or Vercel Blob.
3. Move `runBuild()` to a durable worker/queue. Video analysis and image generation should not run inside a serverless request lifecycle.
4. Add production authentication, organizations, role checks, billing, usage metering, and audit logs.
5. Put secrets in managed environment variables.
6. Add Shopify uninstall/privacy webhooks and delete/revoke stored store credentials when required.
7. Complete Shopify public-app requirements, including theme-write approval if applicable.
8. Point `APP_URL` and Shopify OAuth redirect URLs at the production HTTPS domain.

The project/user/store/build IDs already exist in the data model so this migration does not require changing the New Build workflow.
