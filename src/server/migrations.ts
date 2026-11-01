import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { type RootDoc, SCHEMA_VERSION, schemaVersionOf } from "../shared/schema.ts";

/**
 * A root document as any version might have left it. Migrations read and write it through this
 * type, since a field may be missing, or still have an old name, until its migration runs.
 */
export type AnyRootDoc = Partial<RootDoc> & Record<string, unknown>;

export interface Migration {
  /** The version the root document has after this migration. One more than the one before. */
  version: number;
  /** Changes the document from the previous version to this one, inside one Automerge change. */
  migrate: (root: AnyRootDoc) => void;
}

/**
 * Every change to the root document's shape, oldest first. To change the shape: add a migration
 * here, raise SCHEMA_VERSION to its version, update RootDoc, and add a test that migrates a
 * document of the previous version. Never edit a migration once it's deployed; add another.
 *
 * Only the server migrates, before any client connects: if clients did, two of them making the
 * same change at once (say, creating the same map) would conflict, and one's entries would be lost.
 */
export const migrations: readonly Migration[] = [
  {
    // Folders, and calling notes "documents" ahead of other types of document.
    version: 1,
    migrate: (root) => {
      const notes = root["notes"];
      if (Array.isArray(notes)) {
        root.documents = notes.filter((url): url is AutomergeUrl => typeof url === "string");
        delete root["notes"];
      }
      root.documents ??= [];
      root.positions ??= {};
      root.folders ??= {};
    },
  },
];

/**
 * Brings the root document up to SCHEMA_VERSION, applying every migration it hasn't had in one
 * change, so clients never see it halfway. Refuses a document from a newer version of the server.
 */
export async function migrateRootDoc(repo: Repo, url: AutomergeUrl): Promise<void> {
  const handle = await repo.find<AnyRootDoc>(url);
  const from = schemaVersionOf(handle.doc());
  if (from > SCHEMA_VERSION) {
    throw new Error(
      `The root document is version ${from}, newer than this server knows (${SCHEMA_VERSION}). ` +
        "Deploy a newer version of Scratchpad.",
    );
  }
  const pending = migrations.filter(({ version }) => version > from);
  if (pending.length === 0) return;

  handle.change((root) => {
    for (const { migrate } of pending) migrate(root);
    root.schemaVersion = SCHEMA_VERSION;
  });
  await repo.flush([handle.documentId]);
  console.info(`Migrated the root document from version ${from} to ${SCHEMA_VERSION}`);
}
