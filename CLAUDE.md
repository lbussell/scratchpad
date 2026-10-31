# CLAUDE.md

See README.md for architecture and scripts.

- Run `npm run check` after changes; `npm test` for anything touching sync or the editor.
- Server code runs directly under Node type stripping: use `.ts` import extensions and only
  erasable syntax (no enums, namespaces, or parameter properties).
- Document shapes live in `shared/schema.ts`. Automerge docs are long-lived, so treat schema
  changes as migrations: existing documents won't have new fields.
- Mutate Automerge documents only inside `changeDoc`/`handle.change` callbacks.
