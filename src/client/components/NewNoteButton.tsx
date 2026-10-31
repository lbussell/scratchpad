import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocHandle, useRepo } from "@automerge/automerge-repo-react-hooks";
import { SquarePenIcon } from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import type { NoteDoc, RootDoc } from "../../shared/schema.ts";
import { newNote } from "../notes.ts";
import { DocumentBoundary } from "./DocumentBoundary.tsx";

interface NewNoteButtonProps {
  rootDocUrl: AutomergeUrl;
  onCreate: (url: AutomergeUrl) => void;
}

/** Adds a note to the root document. Disabled until the root document has loaded. */
export function NewNoteButton({ rootDocUrl, onCreate }: NewNoteButtonProps) {
  const disabled = <NewNoteButtonView disabled />;
  return (
    <DocumentBoundary url={rootDocUrl} fallback={disabled}>
      <Suspense fallback={disabled}>
        <LoadedNewNoteButton rootDocUrl={rootDocUrl} onCreate={onCreate} />
      </Suspense>
    </DocumentBoundary>
  );
}

function LoadedNewNoteButton({ rootDocUrl, onCreate }: NewNoteButtonProps) {
  const repo = useRepo();
  const root = useDocHandle<RootDoc>(rootDocUrl, { suspense: true });

  const createNote = () => {
    const note = repo.create<NoteDoc>(newNote());
    root.change((doc) => {
      doc.notes.unshift(note.url);
    });
    onCreate(note.url);
  };

  return <NewNoteButtonView onClick={createNote} />;
}

function NewNoteButtonView({
  disabled = false,
  onClick,
}: {
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="ghost"
      className="mb-2 w-full justify-start"
      disabled={disabled}
      onClick={onClick}
    >
      <SquarePenIcon data-icon="inline-start" />
      New note
    </Button>
  );
}
