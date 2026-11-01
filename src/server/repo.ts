import fs from "node:fs/promises";
import path from "node:path";
import { type AutomergeUrl, isValidAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { WebSocketServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import type { WebSocketServer } from "ws";
import type { RootDoc } from "../shared/schema.ts";

// The adapter's typings resolve `ws` through isomorphic-ws, which produces a WebSocketServer type
// that is identical at runtime but structurally incompatible with the one from `ws`.
type AdapterServer = ConstructorParameters<typeof WebSocketServerAdapter>[0];

export function createSyncRepo(wss: WebSocketServer, dataDir: string): Repo {
  return new Repo({
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see AdapterServer
    network: [new WebSocketServerAdapter(wss as unknown as AdapterServer)],
    storage: new NodeFSStorageAdapter(path.join(dataDir, "automerge")),
    // The server is a relay: it only sends documents that clients ask for.
    sharePolicy: () => Promise.resolve(false),
  });
}

/** Loads the root document's URL from disk, creating the document on first run. */
export async function ensureRootDoc(repo: Repo, dataDir: string): Promise<AutomergeUrl> {
  const urlFile = path.join(dataDir, "root-doc-url");
  const existing = await fs.readFile(urlFile, "utf8").catch(() => undefined);
  const trimmed = existing?.trim();
  if (trimmed !== undefined && isValidAutomergeUrl(trimmed)) {
    await migrateRootDoc(repo, trimmed);
    return trimmed;
  }

  const handle = repo.create<RootDoc>({ documents: [], positions: {}, folders: {} });
  await repo.flush([handle.documentId]);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(urlFile, `${handle.url}\n`);
  console.info(`Created root document ${handle.url}`);
  return handle.url;
}

/** A root document as older versions left it. */
type LegacyRootDoc = Partial<RootDoc> & {
  /** What `documents` was called before there were folders. */
  notes?: AutomergeUrl[];
};

/**
 * Brings a root document from an older version up to date: renames `notes` to `documents` and
 * adds the maps that arrange the sidebar. The server does it before any client connects, because
 * two clients that each created a field at once would conflict, and one's entries would be lost.
 */
async function migrateRootDoc(repo: Repo, url: AutomergeUrl): Promise<void> {
  const handle = await repo.find<LegacyRootDoc>(url);
  const doc = handle.doc();
  if (doc.documents && !doc.notes && doc.positions && doc.folders) return;
  handle.change((root) => {
    root.documents ??= [];
    if (root.notes) {
      // Keeps any written to the old list since an earlier migration, by a client that hadn't
      // updated yet.
      const documents = root.documents;
      const missing = root.notes.filter((document) => !documents.includes(document));
      if (missing.length > 0) documents.splice(0, 0, ...missing);
      delete root.notes;
    }
    root.positions ??= {};
    root.folders ??= {};
  });
  await repo.flush([handle.documentId]);
  console.info("Updated the root document for folders");
}
