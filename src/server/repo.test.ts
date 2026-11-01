import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import type { RootDoc } from "../shared/schema.ts";
import { ensureRootDoc } from "./repo.ts";

const tempDir = () => mkdtemp(path.join(tmpdir(), "scratchpad-repo-"));

function openRepo(dataDir: string): Repo {
  return new Repo({ storage: new NodeFSStorageAdapter(path.join(dataDir, "automerge")) });
}

describe("ensureRootDoc", () => {
  it("creates a root document with room for folders", async () => {
    const dataDir = await tempDir();
    const repo = openRepo(dataDir);
    const url = await ensureRootDoc(repo, dataDir);
    const root = (await repo.find<RootDoc>(url)).doc();
    assert.deepEqual(root, { documents: [], positions: {}, folders: {} });
    await repo.shutdown();
  });

  it("renames notes to documents and adds folders, in a root document from before them", async () => {
    const dataDir = await tempDir();
    const before = openRepo(dataDir);
    const note = before.create({ text: "" }).url;
    const old = before.create({ notes: [note] });
    await before.flush();
    await before.shutdown();
    await writeFile(path.join(dataDir, "root-doc-url"), `${old.url}\n`);

    const repo = openRepo(dataDir);
    const url = await ensureRootDoc(repo, dataDir);
    assert.equal(url, old.url);
    const root = (await repo.find<RootDoc>(url)).doc();
    assert.deepEqual(root, { documents: [note], positions: {}, folders: {} });
    await repo.shutdown();
  });
});
