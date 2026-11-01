import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { useEffect } from "react";
import type { RootDoc } from "../../shared/schema.ts";

/**
 * Downloads every note while online, not just the ones opened, so all of them are on this device
 * (Automerge keeps them in IndexedDB) and open without a connection. Once found, the repo keeps
 * each note in sync, including notes added later.
 */
export function useDownloadAllNotes(rootDocUrl: AutomergeUrl, online: boolean): void {
  const repo = useRepo();
  const [root] = useDocument<RootDoc>(rootDocUrl);
  const notes = root?.notes;

  useEffect(() => {
    if (!online || !notes) return;
    for (const url of notes) {
      // A note that can't be found now is tried again on the next change or reconnect.
      repo.find(url).catch(() => {});
    }
  }, [repo, notes, online]);
}
