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
scripts/    One-off tools (generate-icons.ts renders the Home Screen icons from app-icon.svg)
```

- One server process hosts sync and the web app on one port in both dev and prod.
- On first start the server creates the root document, which lists every document, and saves its
  URL to `data/root-doc-url`. Each document is its own Automerge document. Clients get the root URL
  and their identity from `/api/session`.
- Code that works with any document says "document"; code for a particular type of document names
  the type. So far the only type is the note (`NoteDoc`: a title and text).
- The root document's `positions` (a parent folder and a fractional index for each document and
  folder) and `folders` arrange the sidebar. Change them only through `src/client/tree.ts`, which
  also tidies what concurrent moves leave behind. Deleting a document only removes it from the root
  document; the document itself stays in storage.
- The server stores documents and `users.json` in `data/` (`DATA_DIR`). Delete it to start fresh.
- Identity comes from proxy headers named by `AUTH_USER_ID_HEADER`/`AUTH_EMAIL_HEADER`
  (`docs/deploy.md`), which production requires. Outside production, requests without them
  belong to `DEV_USER_ID`/`DEV_USER_EMAIL`. Identity headers win, which is how e2e tests act as
  different users (`e2e/helpers.ts`, with header names set in `playwright.config.ts`).
- `npm run dev` listens on port 8001 (production on 8000) and loads `.env` if present.
- Presence (sidebar avatars, remote carets, eyes) uses Automerge ephemeral messages, which the
  server relays but never stores (`src/client/presence.ts`).
- The URL hash picks what the main pane shows: a document's Automerge URL, `#settings`, or nothing
  (`src/client/hooks/useRoute.ts`).
- The app is a PWA. `vite-plugin-pwa` writes the manifest (configured in `vite.config.ts`), and
  `src/client/sw.ts` precaches the build so the installed app opens offline. Pages come from the
  network first, so the server and auth proxy still handle logins and deploys; the cached
  `index.html` is only the fallback. The service worker only runs in production builds.
- To start offline, the client saves the last `/api/session` response in localStorage
  (`src/client/session.ts`). While online, it downloads every
  document (`src/client/hooks/useDownloadAllDocuments.ts`), not just the ones opened.
- Every theme token in `src/client/styles.css` derives from the `--hue` and `--tint` variables,
  which come from the user's color (Neutral is `--tint: 0`).

## Develop on exe.dev

You may be working in a checkout on the same exe.dev VM that runs production. Production runs on
port 8000 with its own `DATA_DIR`. The dev server runs on port 8001 and uses `data/` in the
checkout, so the two never share documents.

- To develop as your real exe.dev user, create `.env` in the checkout with the exe.dev settings
  from `docs/deploy.md`, except `DATA_DIR`:

  ```sh
  AUTH_USER_ID_HEADER=X-ExeDev-UserID
  AUTH_EMAIL_HEADER=X-ExeDev-Email
  AUTH_LOGIN_URL='/__exe.dev/login?redirect={path}'
  AUTH_LOGOUT_URL=/__exe.dev/logout
  HOST=127.0.0.1
  ```

- Run `npm run dev` and open `https://<vm>.exe.xyz:8001/` (`hostname` prints the VM name).
  exe.dev forwards that port only to people with access to the VM. `vite.config.ts` allows
  `.exe.xyz` hosts, which Vite would otherwise block.
- `npm run test:e2e` also builds and starts production on port 3301, behind `e2e/auth-proxy.ts`, a
  stand-in for the auth proxy that signs in with a cookie, for tests of the service worker
  (`e2e/offline.spec.ts`). Playwright's extra headers don't reach requests the service worker makes.
- Before the first `npm run test:e2e` on a VM, run `npx playwright install --with-deps chromium`.
- Don't read or change production's data directory, and don't restart or redeploy production
  unless asked. Deploys go through the process in `docs/deploy.md`.

## Rules

- Run `npm run check` after changes; `npm test` for anything touching sync or the editor.
  `npm run lint:fix` and `npm run format` fix most lint and formatting failures. The pre-commit
  hook lints and formats staged files and type-checks the project.
- Server code runs directly under Node type stripping: use `.ts` import extensions and only
  erasable syntax (no enums, namespaces, or parameter properties).
- Document shapes live in `src/shared/schema.ts`. Automerge docs are long-lived, so treat schema
  changes as migrations: existing documents won't have new fields. Prefer new fields that code can
  do without (optional, with a fallback). When the root document's shape changes in a way old code
  can't handle (a rename, a new required field), add a step to `src/server/migrations.ts` and
  raise `SCHEMA_VERSION`. The server migrates at startup, before clients connect; clients refuse a
  root document of another version, asking to reload or waiting for the server
  (`src/client/components/SchemaMismatch.tsx`). Never edit a deployed migration.
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
