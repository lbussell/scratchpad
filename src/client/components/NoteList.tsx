import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
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
      <SidebarHeader className="flex-row items-center justify-between">
        <h1 className="px-2 font-heading text-base font-semibold">Notes</h1>
        <Button size="sm" onClick={createNote}>
          <PlusIcon data-icon="inline-start" />
          New note
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {root.notes.map((url) => (
                <NoteListItem
                  key={url}
                  url={url}
                  isSelected={url === selected}
                  onSelect={onSelect}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
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
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isSelected}
        aria-current={isSelected}
        onClick={() => {
          onSelect(url);
          // On mobile the sidebar is a drawer over the editor, so get it out of the way.
          setOpenMobile(false);
        }}
      >
        <span>{note ? noteTitle(note) : "Loading…"}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
