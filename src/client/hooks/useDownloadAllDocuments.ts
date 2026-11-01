import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { useEffect } from "react";
import type { RootDoc } from "../../shared/schema.ts";

/**
 * Downloads every document while online, not just the ones opened, so all of them are on this device
 * (Automerge keeps them in IndexedDB) and open without a connection. Once found, the repo keeps
 * each document in sync, including documents added later.
 */
export function useDownloadAllDocuments(rootDocUrl: AutomergeUrl, online: boolean): void {
  const repo = useRepo();
  const [root] = useDocument<RootDoc>(rootDocUrl);
  const documents = root?.documents;

  useEffect(() => {
    if (!online || !documents) return;
    for (const url of documents) {
      // A document that can't be found now is tried again on the next change or reconnect.
      repo.find(url).catch(() => {});
    }
  }, [repo, documents, online]);
}
