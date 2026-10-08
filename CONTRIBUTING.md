# Contributing

Thanks for your interest in fadTwibbon. The project is still evolving, so focused changes are easier to review than large rewrites.

## Before you start

- Read [README.md](README.md), [AGENTS.md](AGENTS.md), and the relevant sections of [PRD.md](PRD.md).
- Check existing issues and pull requests before starting duplicate work.
- For a substantial feature or architecture change, open an issue first to agree on scope.

## Development

1. Fork the repository or create a focused branch.
2. Install dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local` and configure your own test environment.
4. Make the smallest change that solves the issue, with tests when appropriate.
5. Run `npm run lint`, `npm test`, and `npm run build` before opening a pull request.

Browser tests can be run with `npm run test:e2e` after installing Playwright browsers. Database integration and security tests require a configured, disposable testing project; never run destructive experiments against production data.

## Pull requests

Describe the problem, the approach, and how you verified the change. Include screenshots for relevant UI changes, but **never** screenshots containing private participant photos, keys, tokens, or personal information. Mention any migration, environment-variable change, or deployment impact.

Keep the mobile experience lightweight, preserve local-only photo processing, and enforce tenant access on the server/database rather than only in the UI.

By contributing, you agree that your contributions will be licensed under the repository's [MIT License](LICENSE).
