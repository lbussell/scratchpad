import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { SCHEMA_VERSION } from "../shared/schema.ts";
import { type AnyRootDoc, migrateRootDoc, migrations } from "./migrations.ts";

/** Migrates a root document with these contents in a fresh repo, and returns the result. */
async function migrated(contents: AnyRootDoc) {
  const repo = new Repo();
  const handle = repo.create<AnyRootDoc>(contents);
  await migrateRootDoc(repo, handle.url);
  return { doc: handle.fullDoc(), heads: handle.heads(), handle, repo };
}

describe("migrations", () => {
  it("count up from 1 to SCHEMA_VERSION", () => {
    assert.deepEqual(
      migrations.map(({ version }) => version),
      Array.from({ length: SCHEMA_VERSION }, (_, index) => index + 1),
    );
  });
});

describe("migrateRootDoc", () => {
  it("leaves an up-to-date document alone", async () => {
    const repo = new Repo();
    const handle = repo.create<AnyRootDoc>({
      schemaVersion: SCHEMA_VERSION,
      documents: [],
      positions: {},
      folders: {},
    });
    const heads = handle.heads();
    await migrateRootDoc(repo, handle.url);
    assert.deepEqual(handle.heads(), heads);
  });

  it("refuses a document from a newer version", async () => {
    const repo = new Repo();
    const handle = repo.create<AnyRootDoc>({ schemaVersion: SCHEMA_VERSION + 1 });
    await assert.rejects(migrateRootDoc(repo, handle.url), /newer than this server knows/);
  });
});

describe("version 1", () => {
  it("renames notes to documents and adds folders", async () => {
    const notes = [generateAutomergeUrl(), generateAutomergeUrl()];
    const { doc } = await migrated({ notes });
    assert.deepEqual(doc, { schemaVersion: 1, documents: notes, positions: {}, folders: {} });
  });

  it("keeps the folders of a document migrated before versions existed", async () => {
    const documents = [generateAutomergeUrl()];
    const positions = { [documents[0] ?? ""]: { parent: null, order: "a0" } };
    const { doc } = await migrated({ documents, positions, folders: {} });
    assert.deepEqual(doc, { schemaVersion: 1, documents, positions, folders: {} });
  });
});
