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
| `npm test`                            | Unit tests (`node --test`), then Playwright end-to-end tests     |
| `npm run lint:fix` / `npm run format` | Auto-fix lint issues / format everything                         |

A pre-commit hook lints and formats staged files and type-checks the project.

## Architecture

```
src/
  client/   React app; also Vite's root (index.html, public/)
  server/   Express server: auth, Automerge sync over WebSocket at /sync, the session and
            profile API, and the client (Vite middleware in dev, dist/client in prod)
  shared/   Types and constants used by both sides (document schemas, URL paths)
e2e/        Playwright tests
```

- **One server.** `src/server/index.ts` hosts the Automerge sync server and the web app on the same
  port in both dev and prod, so there's no proxying and no second process.
- **Root document.** On first start the server creates the root document and saves its URL to
  `data/root-doc-url`. Clients fetch it, along with who they are, from `/api/session`.
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
- **Colors.** Each user picks a color (one of 24 OKLCH hues, or Neutral, stored in their profile).
  It tints the whole app through the `--hue` and `--tint` CSS variables that every theme token in
  `styles.css` is built from (Neutral is `--tint: 0`), and others see their cursor in it. Tokens fix lightness and use the chroma every hue
  can reach, so all colors are equally vivid (a bit more so on P3 screens).
- **Presence.** Shared through Automerge's ephemeral presence messages (relayed by the server,
  never stored; see `presence.ts`):
  - The sidebar shows an avatar beside each note someone else has open. It slides to the new
    note when they switch.
  - In a note, the editor shows other people's carets and selections.
  - Beside the title, each person gets a little pair of eyes. The eyes look towards their mouse,
    or their caret, blink when they click, and close after 30 seconds of inactivity.
- **Text fields.** Plain `<input>`s and `<textarea>`s, like the note title, bind to Automerge
  strings with `useAutomergeText`, which merges edits character by character and keeps the caret
  in place when someone else edits.
- **Compression.** `npm run build` writes Brotli and gzip copies of each asset at maximum
  quality, and the production server serves whichever the browser accepts. Hashed files in
  `assets/` are cached as immutable for a year; `index.html` always revalidates.
- **No build step for the server.** Node runs `src/server/*.ts` directly through type stripping, so
  server code must use only erasable TypeScript syntax (enforced by `erasableSyntaxOnly`).

## Authentication

The app expects to run behind an HTTPS proxy that signs people in and passes who they are in
request headers, as [exe.dev](https://www.exe.dev/docs/login-with-exe.md) does. Everyone the
proxy lets through is a user. The server identifies them from the headers on every request,
including the `/sync` WebSocket. It keeps profiles (name, cursor color) in `data/users.json`,
and each user can change only their own name. A new user's name defaults to the part of their
email before the `@`.

**Only expose the app through the proxy.** Anyone who can reach the server directly can send
their own identity headers. Set `HOST=127.0.0.1` if the proxy runs on the same machine.

| Variable              | Default            | Purpose                                                        |
| --------------------- | ------------------ | -------------------------------------------------------------- |
| `AUTH_USER_ID_HEADER` | `X-ExeDev-UserID`  | Header with the user's stable ID                               |
| `AUTH_EMAIL_HEADER`   | `X-ExeDev-Email`   | Header with the user's email                                   |
| `AUTH_LOGIN_URL`      | (none: plain 401)  | Where signed-out visitors go; `{path}` is the page they wanted |
| `AUTH_LOGOUT_URL`     | (none: no log out) | The client POSTs here to log out                               |
| `HOST`                | all interfaces     | Address to listen on                                           |
| `DEV_USER_ID`         | `dev`              | Development only: user for requests without the headers        |
| `DEV_USER_EMAIL`      | `dev@example.com`  | Development only: that user's email                            |

For exe.dev:

```sh
AUTH_LOGIN_URL='/__exe.dev/login?redirect={path}' AUTH_LOGOUT_URL=/__exe.dev/logout npm start
```

In development, requests without identity headers belong to the dev user. Headers still win, which
is how the e2e tests act as different users (see `e2e/helpers.ts`).

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
