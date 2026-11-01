import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocHandle, useRepo } from "@automerge/automerge-repo-react-hooks";
import { ChevronDownIcon, FolderPlusIcon, PlusIcon } from "lucide-react";
import { Suspense, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DocumentTypeId, FolderId, RootDoc } from "../../shared/schema.ts";
import { documentTypeIds, documentTypes } from "../documentTypes.ts";
import { addFolder, addDocument, newFolderId } from "../tree.ts";
import { DocumentBoundary } from "./DocumentBoundary.tsx";

interface NewMenuProps {
  rootDocUrl: AutomergeUrl;
  onCreateDocument: (url: AutomergeUrl) => void;
  onCreateFolder: (id: FolderId) => void;
}

/**
 * Adds a document of any type, or a folder, to the top of the sidebar. Disabled until the root document has loaded.
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

function LoadedNewMenu({ rootDocUrl, onCreateDocument, onCreateFolder }: NewMenuProps) {
  const repo = useRepo();
  const root = useDocHandle<RootDoc>(rootDocUrl, { suspense: true });

  const createDocument = (type: DocumentTypeId) => {
    movesFocus.current = true;
    const handle = repo.create(documentTypes[type].create());
    root.change((doc) => addDocument(doc, handle.url));
    onCreateDocument(handle.url);
  };

  // The menu puts focus back on its button as it closes, which would take it from the new
  // document's title or folder's name.
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
        {documentTypeIds.map((type) => {
          const { name, icon: Icon } = documentTypes[type];
          return (
            <DropdownMenuItem key={type} onClick={() => createDocument(type)}>
              <Icon />
              {name}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
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
