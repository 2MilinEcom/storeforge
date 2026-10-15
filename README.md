# StoreForge

I built StoreForge to bring product research and storefront preparation into one workflow. I start with a product URL, review the available information and media, and prepare an unpublished storefront to inspect.

I included product and reference research, media processing, generated page sections, and a visual review loop. I kept unsupported merchant details flagged rather than filling in prices, reviews, or guarantees without evidence.

## Built with

I used Next.js, React, and TypeScript. The media tools use FFmpeg, and the optional research features use external services.

## Inside the project

* `src/app/`: the web interface and routes.
* `src/lib/`: research, media, and storefront services.
* `scripts/`: local setup and source checks.
* `docs/`: setup notes and development history.

## Running it

I install dependencies with `npm ci`, copy `.env.example` to my local environment file, and configure the services I want to use. I start the interface with `npm run dev`.

I keep merchant credentials and generated storefront files outside version control. Store creation and publishing still depend on my own connected services and account permissions.

## More detail

* [Project guide](PROJECT_GUIDE.md)
* [Architecture](ARCHITECTURE.md)
* [Local setup](START_HERE.md)
