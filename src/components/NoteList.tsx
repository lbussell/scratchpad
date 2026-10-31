import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import type { NoteDoc, RootDoc } from "../../shared/schema.ts";
import { newNote, noteTitle } from "../notes.ts";

interface NoteListProps {
  rootDocUrl: AutomergeUrl;
  selected: AutomergeUrl | undefined;
  onSelect: (url: AutomergeUrl) => void;
}

export function NoteList({ rootDocUrl, selected, onSelect }: NoteListProps) {
  const repo = useRepo();
  const [root, changeRoot] = useDocument<RootDoc>(rootDocUrl, { suspense: true });

  const createNote = () => {
    const handle = repo.create<NoteDoc>(newNote());
    changeRoot((doc) => {
      doc.notes.unshift(handle.url);
    });
    onSelect(handle.url);
  };

  return (
    <>
      <header className="sidebar-header">
        <h1>Notes</h1>
        <button type="button" onClick={createNote}>
          New note
        </button>
      </header>
      <ul className="note-list">
        {root.notes.map((url) => (
          <NoteListItem key={url} url={url} isSelected={url === selected} onSelect={onSelect} />
        ))}
      </ul>
    </>
  );
}

interface NoteListItemProps {
  url: AutomergeUrl;
  isSelected: boolean;
  onSelect: (url: AutomergeUrl) => void;
}

function NoteListItem({ url, isSelected, onSelect }: NoteListItemProps) {
  // Not suspending, so one slow note doesn't block the whole list.
  const [note] = useDocument<NoteDoc>(url);

  return (
    <li>
      <button
        type="button"
        className="note-list-item"
        aria-current={isSelected}
        onClick={() => onSelect(url)}
      >
        {note ? noteTitle(note) : "Loading…"}
      </button>
    </li>
  );
}
