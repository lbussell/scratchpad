# Scratchpad

Scratchpad is a collaborative document editor built on
[Automerge](https://automerge.org).

## Try it locally

You need [Node.js](https://nodejs.org) 24 or later.

```sh
npm install
npm run dev
```

## Install it on your phone

Scratchpad is a Progressive Web App. Open it in Safari on iPhone and choose
**Share → Add to Home Screen**, or in Chrome on Android choose **Install app**.
The installed app opens without a connection and syncs your changes when you're
back online.

## Deploying Scratchpad

[![Deploy on exe.dev](https://raw.githubusercontent.com/boldsoftware/exe.dev/main/assets/buttons/deploy-on-exe-dev.png)](https://exe.dev/new?repo=https://github.com/lbussell/scratchpad)

Scratchpad is designed to run behind a secure HTTPS proxy. Your proxy should
authenticate users and pass user identity headers to Scratchpad. Everything
behind the proxy is fully trusted.

For more details, see [Deploy Scratchpad](docs/deploy.md).

## Development

Before you commit, run `npm run check` to type-check, lint, and check
formatting. Run `npm test` to run the unit tests and the Playwright end-to-end
tests. [CLAUDE.md](CLAUDE.md) lists the project's code layout and conventions.
