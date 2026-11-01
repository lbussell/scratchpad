import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useDocHandle, useDocument } from "@automerge/automerge-repo-react-hooks";
import { Input } from "@/components/ui/input";
import type { BaseDoc } from "../../shared/schema.ts";
import { documentTitle } from "../documentTypes.ts";
import { useAutomergeText } from "../hooks/useAutomergeText.ts";

const TITLE_PATH = ["title"];

/** Edits the document's title in place. Every type of document has one. */
export function DocumentTitle({ url }: { url: AutomergeUrl }) {
  // Not suspending: the editor below handles loading and errors for the document.
  const handle = useDocHandle<BaseDoc>(url);
  const [doc] = useDocument<BaseDoc>(url);
  if (!handle || !doc) return null;
  return <TitleInput handle={handle} doc={doc} />;
}

function TitleInput({ handle, doc }: { handle: DocHandle<BaseDoc>; doc: BaseDoc }) {
  const title = useAutomergeText(handle, TITLE_PATH);

  return (
    <Input
      {...title}
      variant="ghost"
      aria-label="Title"
      // Blank titles show what the sidebar calls the document.
      placeholder={documentTitle(doc)}
      // New documents start here; the editor takes focus otherwise. Only applies on mount, and
      // this component is keyed by document.
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- the user just asked for a new document.
      autoFocus={doc.title === ""}
    />
  );
}
