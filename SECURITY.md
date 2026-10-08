# Security policy

fadTwibbon is under active development and does not yet have a stable, supported release. The current `main` branch receives best-effort security fixes.

## Reporting a vulnerability

**Do not disclose security vulnerabilities in public issues or pull requests.**

Use the repository's **Security → Report a vulnerability** option if private vulnerability reporting is enabled. If it is not available, contact the maintainer through a private contact channel listed on their [GitHub profile](https://github.com/fadd3079-prog) before sharing exploit details publicly.

A helpful report includes the affected component, a minimal reproduction, expected versus actual behavior, and potential impact. Do not include real users' photos, credentials, or private data.

## Security expectations

- Participant photos must remain in the local browser.
- Supabase service-role keys and database credentials must never be committed or placed in `VITE_` environment variables.
- Tenant authorization must be enforced through appropriate backend checks and PostgreSQL RLS.
- Depend on non-production data and resources for security testing.
- Review migrations, Edge Function permissions, and dependency updates before deployment.

We aim to acknowledge and address valid reports as resources permit, but cannot promise a fixed response time.
