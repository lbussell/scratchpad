import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import {
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { NoteDoc, RootDoc } from "../../shared/schema.ts";
import { noteTitle } from "../notes.ts";

interface NoteListProps {
  rootDocUrl: AutomergeUrl;
  selected: AutomergeUrl | undefined;
  onSelect: (url: AutomergeUrl) => void;
}

export function NoteList({ rootDocUrl, selected, onSelect }: NoteListProps) {
  const [root] = useDocument<RootDoc>(rootDocUrl, { suspense: true });

  return (
    <SidebarGroupContent>
      <SidebarMenu>
        {root.notes.map((url) => (
          <NoteListItem key={url} url={url} isSelected={url === selected} onSelect={onSelect} />
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
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
