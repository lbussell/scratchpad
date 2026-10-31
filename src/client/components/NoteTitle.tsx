import { type AutomergeUrl, updateText } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { Input } from "@/components/ui/input";
import type { NoteDoc } from "../../shared/schema.ts";
import { noteTitle } from "../notes.ts";

/** Edits the note's title in place. */
export function NoteTitle({ url }: { url: AutomergeUrl }) {
  // Not suspending: the editor below handles loading and errors for the note.
  const [note, changeNote] = useDocument<NoteDoc>(url);
  if (!note) return null;

  return (
    <Input
      variant="ghost"
      aria-label="Title"
      // Blank titles show what the sidebar calls the note.
      placeholder={noteTitle(note)}
      value={note.title ?? ""}
      // New notes start here; the editor takes focus otherwise. Only applies on mount, and this
      // component is keyed by note.
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- the user just asked for a new note.
      autoFocus={note.title === ""}
      onChange={(event) => {
        const title = event.target.value;
        changeNote((doc) => {
          // Diffs against the current title so concurrent edits merge character by character.
          if (doc.title === undefined) doc.title = title;
          else updateText(doc, ["title"], title);
        });
      }}
    />
  );
}
