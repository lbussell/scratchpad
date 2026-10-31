# CLAUDE.md

See README.md for architecture and scripts.

- Run `npm run check` after changes; `npm test` for anything touching sync or the editor.
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
