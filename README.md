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
- **UI.** [shadcn/ui](https://ui.shadcn.com) components on [Base UI](https://base-ui.com), styled
  with Tailwind CSS v4. Generated components live in `src/client/components/ui/`; add more with
  `npx shadcn add <component>`. Theme colors are CSS variables in `src/client/styles.css`. The
  light/dark/system choice (on the Settings page) is stored in `localStorage` and applied by an
  inline script in `index.html` before first paint.
- **Routing.** The URL hash says what the main pane shows: a note's Automerge URL, `#settings`,
  or nothing (see `useRoute`).
- **Editing.** Notes use CodeMirror with `@automerge/automerge-codemirror`, which turns edits into
  character-level Automerge splices so concurrent typing merges cleanly.
- **Cursors.** The note editor shows other people's carets and selections, shared through
  Automerge's ephemeral presence messages (relayed by the server, never stored). Each browser
  picks a random hue once; lightness and chroma are fixed per theme (`--presence-*` in
  `styles.css`) so every color is equally visible.
- **Text fields.** Plain `<input>`s and `<textarea>`s, like the note title, bind to Automerge
  strings with `useAutomergeText`, which merges edits character by character and keeps the caret
  in place when someone else edits.
- **Compression.** `npm run build` writes Brotli and gzip copies of each asset at maximum
  quality, and the production server serves whichever the browser accepts. Hashed files in
  `assets/` are cached as immutable for a year; `index.html` always revalidates.
- **No build step for the server.** Node runs `src/server/*.ts` directly through type stripping, so
  server code must use only erasable TypeScript syntax (enforced by `erasableSyntaxOnly`).

## Tooling

- TypeScript 7 (native compiler) with strict options, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`
- [Oxlint](https://oxc.rs/docs/guide/usage/linter) with type-aware rules, configured to fail on
  any warning
- [@shadcn/lint](https://github.com/shadcn-ui/lint), as an Oxlint plugin, enforces the design
  system: theme colors only, no arbitrary values, inline styles, unknown classes or dynamic class
  strings, and pages may only position components (`className` layout classes such as margin or
  width), not restyle them. Components in `components/ui/` are allowed to style themselves.
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) for formatting. Install the recommended Oxc
  VS Code extension to format on save.
