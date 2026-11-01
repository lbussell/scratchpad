# Scratchpad

Scratchpad is a collaborative document editor built on
[Automerge](https://automerge.org).

[![Deploy on exe.dev](https://raw.githubusercontent.com/boldsoftware/exe.dev/main/assets/buttons/deploy-on-exe-dev.png)](https://exe.dev/new?repo=https://github.com/lbussell/scratchpad)

## Try it locally

You need [Node.js](https://nodejs.org) 24 or later.

```sh
npm install
npm run dev
```

## Deploying Scratchpad

Scratchpad is designed to run behind a secure HTTPS proxy. Your proxy should
authenticate users and pass user identity headers to Scratchpad. Everything
behind the proxy is fully trusted.

For more details, see [Deploy Scratchpad](docs/deploy.md).

## Development

Before you commit, run `npm run check` to type-check, lint, and check
formatting. Run `npm test` to run the unit tests and the Playwright end-to-end
tests. [CLAUDE.md](CLAUDE.md) lists the project's code layout and conventions.
