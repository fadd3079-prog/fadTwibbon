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

`npm run test:production` runs the browser suite against a compiled build with the actual Vercel CSP and headers, using mocked backend responses. `npm run check:edge` checks the server functions with Deno 2. `npm run test:security` checks database permissions inside a transaction that is always rolled back. `npm run test:live` creates isolated `fadtwibbon-test-*` accounts, exercises real Auth/Storage/functions, then removes only those generated accounts and assets. Use a staging project and an authenticated Supabase CLI; never put privileged credentials in the frontend.

## Supabase setup

The linked project is `brumpzehrkbnnjsrpcxt`. Before changing a different environment, inspect its schema, migration history, buckets, and Auth configuration.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list --linked
supabase db push --linked --dry-run
supabase db push --linked
supabase functions deploy --use-api
```

Set Edge secrets `ALLOWED_ORIGINS` (comma-separated exact site origins, without trailing slashes) and `ANALYTICS_HMAC_SECRET` (a random secret of at least 32 bytes) with `supabase secrets set --env-file PATH_TO_PRIVATE_FILE`. Keep that file outside Git. Built-in service-role credentials stay inside Edge Functions. Gateway JWT checks are intentionally disabled for these functions: public endpoints validate their own payloads, and protected endpoints explicitly verify the caller with Supabase Auth and database authorization.

In Supabase Auth, enable email confirmation, require at least 12-character passwords, configure production SMTP, and allow exact `/auth/callback` and `/reset-password` URLs for your site. Set the production Site URL. Review `supabase config diff` before any config push; do not push unrelated local defaults over an existing remote project. Local callback URLs are already configured on the linked project.

New administrators are pending: verified accounts may prepare drafts, but a superadmin must approve them before publication. Templates must be 8-bit, non-interlaced, non-animated PNGs with a visible frame and at least 1% useful transparency. Server and browser validation enforce 3 MB, 4,096 pixels per side, and 16 megapixels. Default account quotas are 10 campaigns, 5 published, and 30 MB of private templates; public delivery may add another copy.

## First superadmin

Register your own account and verify its email. Find **your exact user UUID** in the Auth dashboard. Run the following only in the trusted Supabase SQL Editor, replacing the placeholder. No public API can assign this role. The guard prevents accidentally provisioning another owner after the first one exists.

```sql
begin;
do $$
declare owner uuid := 'REPLACE_WITH_YOUR_VERIFIED_USER_UUID';
begin
  if exists(select 1 from public.user_roles where role='super_admin') then
    raise exception 'A superadmin already exists';
  end if;
  if not exists(select 1 from auth.users where id=owner and email_confirmed_at is not null) then
    raise exception 'Owner must have a verified account';
  end if;
  update public.profiles set status='active' where user_id=owner;
  update public.user_roles set role='super_admin',assigned_at=now() where user_id=owner;
  perform private.audit(owner,'bootstrap','profile',owner);
end $$;
commit;
```

Sign in again and open `/superadmin`. Use a unique password and secure the Supabase operator account with MFA. Keep owner recovery instructions and credentials outside this repository. Existing superadmins must not be demoted or replaced automatically.

## Vercel deployment

Import the existing GitHub repository, choose Vite, build with `npm run build`, and serve `dist`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel before rebuilding. `vercel.json` supplies application route rewrites, immutable asset caching, and security headers. Add the deployed origin to Edge `ALLOWED_ORIGINS` and the exact Auth redirect URLs; avoid unrestricted preview-domain wildcards. Test a direct campaign URL, refresh, login, publication, and PNG download on the deployed domain.

Light, dark, and system themes are available throughout the app. Only the theme preference is persisted locally; photos are not. The public page loads the small editor separately from the Auth SDK and dashboard.

## Operations and limitations

- Published metadata has a 30-second cache lifetime; a suspended/unpublished page may remain cached briefly, and already-open editors or previously distributed PNGs cannot be revoked.
- Analytics uses idempotent event tokens and a 30-events/minute source limit. Daily rotating HMAC source hashes expire after one day; raw events after 30 days; audit records after 180 days. PostgreSQL schedules retention hourly; daily aggregates remain until their campaign is deleted. Visitors behind a shared network may be undercounted. This is not anti-fraud proof.
- Uploads keep the active template and two previous versions. Cleanup retries after uploads and through **Superadmin → Pengaturan → Bersihkan aset versi lama**. Failed removal is queued; check the queue and physical Storage usage after outages. Audit/statistics bytes do not represent complete provider quota usage.
- Self-service deletion requires a fresh password sign-in and does not allow deleting a superadmin. Interrupted deletion freezes the account and can be resumed in `/admin/settings`. Provider backups and already-downloaded public assets follow their separate retention rules.
- Run `npm run preview`, then `npm run test:load` for a safe localhost-only 25/50/100/250/500-request burst. This measures static HTTP serving, **not** 500 concurrent editing users or Supabase capacity. For staging, separately measure campaign/template reads, download events, cache hits, p50/p95, error rate, egress, and mobile memory; obtain provider permission before load testing. Real Android/iPhone/Safari and email delivery remain release checks.

Verification evidence and the design Delivery Gate are in [docs/VERIFICATION.md](docs/VERIFICATION.md).

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
