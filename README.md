# fadTwibbon

A lightweight, mobile-first Twibbon campaign platform. Campaign owners create and share PNG frames; visitors can position a photo, download the result, and copy a caption without creating an account.

> **Status:** Under active development. Features and deployment setup are still being verified; this is not a stable release.

## Features

- Public campaign links and a browser-based photo editor (move, zoom, rotate, export).
- Local photo processing with the Canvas API: participant photos are not uploaded to the application server.
- Campaign and template management for registered administrators.
- Separate administrative permissions for the platform owner.
- Download activity statistics for campaign owners.

**Privacy note:** Public campaign templates are delivered to visitors' browsers and are not secret. Download statistics represent recorded activity, not verified unique people or guaranteed file saves.

## Tech stack

- **Frontend:** Vanilla JavaScript, CSS, Vite, Canvas API
- **Backend:** Supabase Auth, PostgreSQL, Storage, Edge Functions
- **Deployment:** Vercel (static frontend)
- **Testing:** Node.js test runner, Playwright, ESLint

## Run locally

Requirements: Node.js **22.12+** and npm. A configured Supabase project is needed for authenticated and campaign functionality.

```bash
git clone https://github.com/fadd3079-prog/fadTwibbon.git
cd fadTwibbon
npm ci
cp .env.example .env.local
npm run dev
```

Set these values in `.env.local` using your own Supabase project:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Only public/publishable keys belong in variables prefixed with `VITE_`. Never put a Supabase service-role key, database password, or another secret in frontend variables.

The backend schema is managed in `supabase/migrations/`, and Edge Functions live under `supabase/functions/`. Review migrations before applying them to a database, preferably using a separate development project first. Function secrets and authentication redirects must be configured for the target environment.

## Checks

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

For the Playwright suite, install the required browsers first with `npx playwright install`. Live integration and database security scripts require an explicitly configured Supabase test environment; do not aim those tests at production by default.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/editor/` | Image loading, transformations, and canvas rendering |
| `src/pages/` | Public, authentication, and dashboard pages |
| `src/services/` | Supabase and campaign integrations |
| `supabase/migrations/` | Database schema and policies |
| `supabase/functions/` | Server-side endpoints |
| `tests/` | Unit, integration, browser, and local load tests |
| `PRD.md` | Product requirements and architectural decisions |
| `AGENTS.md` | Contributor and coding-agent guidelines |

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and [SECURITY.md](SECURITY.md) to report security issues privately.

This project is licensed under the [MIT License](LICENSE).
