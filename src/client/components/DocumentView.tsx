import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocHandle, useDocument } from "@automerge/automerge-repo-react-hooks";
import { FileQuestionIcon } from "lucide-react";
import type { BaseDoc } from "../../shared/schema.ts";
import { documentTypeOf } from "../documentTypes.ts";
import type { WorkspacePeer } from "../presence.ts";
import { PeopleHere } from "./PeopleHere.tsx";
import { StatusMessage } from "./StatusMessage.tsx";

/** The open document, shown by its type's editor. Suspends while it loads. */
export function DocumentView({ url }: { url: AutomergeUrl }) {
  const handle = useDocHandle<BaseDoc>(url, { suspense: true });
  // A document's type never changes, so there's no need to watch for changes.
  const type = documentTypeOf(handle.fullDoc());
  if (!type) {
    return (
      <StatusMessage icon={<FileQuestionIcon />}>
        This document needs a newer version of Scratchpad. Reload the page to update.
      </StatusMessage>
    );
  }
  const { Editor } = type;
  return <Editor url={url} />;
}

interface DocumentPeersProps {
  url: AutomergeUrl;
  /** Who else has the document open, from the workspace's presence. */
  peers: readonly WorkspacePeer[];
}

/** Who else has the document open, beside its title: however its type shows them. */
export function DocumentPeers({ url, peers }: DocumentPeersProps) {
  // Not suspending: the editor below handles loading and errors for the document.
  const [doc] = useDocument<BaseDoc>(url);
  if (!doc) return null;
  const Peers = documentTypeOf(doc)?.Peers;
  if (Peers) return <Peers url={url} />;
  return (
    <span className="flex shrink-0 items-center px-1">
      <PeopleHere peers={peers} />
    </span>
  );
}
