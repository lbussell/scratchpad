import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocHandle, useRepo } from "@automerge/automerge-repo-react-hooks";
import { ChevronDownIcon, FolderPlusIcon, PlusIcon, SquarePenIcon } from "lucide-react";
import { Suspense, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FolderId, NoteDoc, RootDoc } from "../../shared/schema.ts";
import { newNote } from "../notes.ts";
import { addFolder, addDocument, newFolderId } from "../tree.ts";
import { DocumentBoundary } from "./DocumentBoundary.tsx";

interface NewMenuProps {
  rootDocUrl: AutomergeUrl;
  onCreateNote: (url: AutomergeUrl) => void;
  onCreateFolder: (id: FolderId) => void;
}

/**
 * Adds a note or folder to the top of the sidebar. Disabled until the root document has loaded.
 */
export function NewMenu(props: NewMenuProps) {
  const disabled = <NewButton disabled />;
  return (
    <DocumentBoundary url={props.rootDocUrl} fallback={disabled}>
      <Suspense fallback={disabled}>
        <LoadedNewMenu {...props} />
      </Suspense>
    </DocumentBoundary>
  );
}

function LoadedNewMenu({ rootDocUrl, onCreateNote, onCreateFolder }: NewMenuProps) {
  const repo = useRepo();
  const root = useDocHandle<RootDoc>(rootDocUrl, { suspense: true });

  const createNote = () => {
    movesFocus.current = true;
    const note = repo.create<NoteDoc>(newNote());
    root.change((doc) => addDocument(doc, note.url));
    onCreateNote(note.url);
  };

  // The menu puts focus back on its button as it closes, which would take it from the new note's
  // title or folder's name.
  const movesFocus = useRef(false);

  const createFolder = () => {
    movesFocus.current = true;
    const id = newFolderId();
    root.change((doc) => addFolder(doc, id));
    onCreateFolder(id);
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) movesFocus.current = false;
      }}
    >
      <DropdownMenuTrigger render={<NewButton />} />
      <DropdownMenuContent finalFocus={() => !movesFocus.current}>
        <DropdownMenuItem onClick={createNote}>
          <SquarePenIcon />
          Note
        </DropdownMenuItem>
        <DropdownMenuItem onClick={createFolder}>
          <FolderPlusIcon />
          Folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" className="mb-2 w-full justify-start" {...props}>
      <PlusIcon data-icon="inline-start" />
      New
      <ChevronDownIcon className="ml-auto" />
    </Button>
  );
}
