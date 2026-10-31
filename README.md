# scratchpad

A collaborative notes app built on [Automerge](https://automerge.org). Every user shares a single
root document listing all notes, and each note is its own Automerge document that people edit
together in real time.

## Getting started

Requires Node 24+.

```sh
npm install
npm run dev
```

Open <http://localhost:3000> in a few tabs or browsers. Notes you create, and edits you make,
appear everywhere live.

## Scripts

| Script                                | What it does                                                     |
| ------------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                         | App + sync server with Vite HMR; restarts on server changes      |
| `npm run build`                       | Type-check and build the client to `dist/client`                 |
| `npm start`                           | Production server: static app + sync server on one port (`PORT`) |
| `npm run check`                       | Type-check, lint, and verify formatting (what CI runs)           |
| `npm test`                            | Playwright end-to-end tests against a throwaway server           |
| `npm run lint:fix` / `npm run format` | Auto-fix lint issues / format everything                         |

A pre-commit hook lints and formats staged files and type-checks the project.

## Architecture

```
src/
  client/   React app; also Vite's root (index.html, public/)
  server/   Express server: Automerge sync over WebSocket at /sync, root doc URL at /api/root,
            and the client (Vite middleware in dev, static files from dist/client in prod)
  shared/   Types and constants used by both sides (document schemas, URL paths)
e2e/        Playwright tests
```

- **One server.** `src/server/index.ts` hosts the Automerge sync server and the web app on the same
  port in both dev and prod, so there's no proxying and no second process.
- **Root document.** On first start the server creates the root document and saves its URL to
  `data/root-doc-url`. Clients fetch it from `/api/root`.
- **Storage.** The server persists documents in `data/` (override with `DATA_DIR`). Delete it to
  start fresh. Clients cache documents in IndexedDB and sync between tabs over BroadcastChannel.
- **Editing.** Notes use CodeMirror with `@automerge/automerge-codemirror`, which turns edits into
  character-level Automerge splices so concurrent typing merges cleanly.
- **No build step for the server.** Node runs `src/server/*.ts` directly through type stripping, so
  server code must use only erasable TypeScript syntax (enforced by `erasableSyntaxOnly`).

## Tooling

- TypeScript 7 (native compiler) with strict options, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`
- [Oxlint](https://oxc.rs/docs/guide/usage/linter) with type-aware rules, configured to fail on
  any warning
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) for formatting. Install the recommended Oxc
  VS Code extension to format on save.
