# CLAUDE.md

See README.md for what the app does and how to run and deploy it.

## Layout

```
src/
  client/   React app; also Vite's root (index.html, public/)
  server/   Express server: auth, Automerge sync over WebSocket at /sync, the session and
            profile API, and the client (Vite middleware in dev, dist/client in prod)
  shared/   Types and constants used by both sides (document schemas, URL paths)
e2e/        Playwright tests
```

- One server process hosts sync and the web app on one port in both dev and prod.
- On first start the server creates the root document, which lists every note, and saves its URL
  to `data/root-doc-url`. Each note is its own Automerge document. Clients get the root URL and
  their identity from `/api/session`.
- The server stores documents and `users.json` in `data/` (`DATA_DIR`). Delete it to start fresh.
- Identity comes from proxy headers named by `AUTH_USER_ID_HEADER`/`AUTH_EMAIL_HEADER`
  (`docs/deploy.md`), which production requires. Outside production, requests without them
  get a made-up user per browser tab (`src/client/devTab.ts`, `devTabUser` in
  `src/server/auth.ts`); with no tab ID they get `DEV_USER_ID`/`DEV_USER_EMAIL`. Identity headers
  still win, which is how e2e tests act as different users (`e2e/helpers.ts`, with header names
  set in `playwright.config.ts`).
- Presence (sidebar avatars, remote carets, eyes) uses Automerge ephemeral messages, which the
  server relays but never stores (`src/client/presence.ts`).
- The URL hash picks what the main pane shows: a note's Automerge URL, `#settings`, or nothing
  (`src/client/hooks/useRoute.ts`).
- Every theme token in `src/client/styles.css` derives from the `--hue` and `--tint` variables,
  which come from the user's color (Neutral is `--tint: 0`).

## Rules

- Run `npm run check` after changes; `npm test` for anything touching sync or the editor.
  `npm run lint:fix` and `npm run format` fix most lint and formatting failures. The pre-commit
  hook lints and formats staged files and type-checks the project.
- Server code runs directly under Node type stripping: use `.ts` import extensions and only
  erasable syntax (no enums, namespaces, or parameter properties).
- Document shapes live in `src/shared/schema.ts`. Automerge docs are long-lived, so treat schema
  changes as migrations: existing documents won't have new fields.
- Mutate Automerge documents only inside `changeDoc`/`handle.change` callbacks.
- UI uses shadcn/ui (Base UI). Add components with `npx shadcn add <name>` rather than writing
  them by hand, and import them via `@/components/ui/...` so @shadcn/lint recognizes them. Need a
  different look? Add a variant in the component file instead of overriding it with `className`.
  New colors go in `src/client/styles.css` as theme tokens, not raw Tailwind palette classes.
- After `shadcn add`, run `npm run check`: generated code sometimes needs small fixes for our
  stricter lint rules. Fix them in the generated file.
- Bind text inputs to Automerge strings with `useAutomergeText` (or CodeMirror for long-form
  text), not a plain controlled `value`/`onChange`, which makes the caret jump on remote edits.
- Per-user data that only its owner may change (profiles, settings) lives on the server
  (`src/server/users.ts`), not in Automerge documents, which every client can write.
- Server logic that e2e tests can't reach (production-only behavior) gets `node --test` unit
  tests next to it (`*.test.ts`).
