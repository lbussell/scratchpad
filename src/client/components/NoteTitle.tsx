import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useDocHandle, useDocument } from "@automerge/automerge-repo-react-hooks";
import { Input } from "@/components/ui/input";
import type { NoteDoc } from "../../shared/schema.ts";
import { useAutomergeText } from "../hooks/useAutomergeText.ts";
import { noteTitle } from "../notes.ts";

const TITLE_PATH = ["title"];

/** Edits the note's title in place. */
export function NoteTitle({ url }: { url: AutomergeUrl }) {
  // Not suspending: the editor below handles loading and errors for the note.
  const handle = useDocHandle<NoteDoc>(url);
  const [note] = useDocument<NoteDoc>(url);
  if (!handle || !note) return null;
  return <TitleInput handle={handle} note={note} />;
}

function TitleInput({ handle, note }: { handle: DocHandle<NoteDoc>; note: NoteDoc }) {
  const title = useAutomergeText(handle, TITLE_PATH);

  return (
    <Input
      {...title}
      variant="ghost"
      aria-label="Title"
      // Blank titles show what the sidebar calls the note.
      placeholder={noteTitle(note)}
      // New notes start here; the editor takes focus otherwise. Only applies on mount, and this
      // component is keyed by note.
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- the user just asked for a new note.
      autoFocus={note.title === ""}
    />
  );
}
