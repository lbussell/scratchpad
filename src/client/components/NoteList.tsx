import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { SquareTextIcon } from "lucide-react";
import { PeerAvatar, PeerAvatarGroup } from "@/components/ui/peer";
import {
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { NoteDoc, RootDoc } from "../../shared/schema.ts";
import { initials } from "../initials.ts";
import { noteTitle } from "../notes.ts";
import type { WorkspacePeer } from "../presence.ts";

interface NoteListProps {
  rootDocUrl: AutomergeUrl;
  selected: AutomergeUrl | undefined;
  onSelect: (url: AutomergeUrl) => void;
  /** Who else has each note open. */
  peers: ReadonlyMap<AutomergeUrl, readonly WorkspacePeer[]>;
}

const nobody: readonly WorkspacePeer[] = [];
const names = new Intl.ListFormat(undefined, { type: "conjunction" });

export function NoteList({ rootDocUrl, selected, onSelect, peers }: NoteListProps) {
  const [root] = useDocument<RootDoc>(rootDocUrl, { suspense: true });

  return (
    <SidebarGroupContent>
      <SidebarMenu>
        {root.notes.map((url) => (
          <NoteListItem
            key={url}
            url={url}
            isSelected={url === selected}
            onSelect={onSelect}
            peers={peers.get(url) ?? nobody}
          />
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  );
}

interface NoteListItemProps {
  url: AutomergeUrl;
  isSelected: boolean;
  onSelect: (url: AutomergeUrl) => void;
  peers: readonly WorkspacePeer[];
}

function NoteListItem({ url, isSelected, onSelect, peers }: NoteListItemProps) {
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
        <SquareTextIcon />
        <span className="flex-1 truncate">{note ? noteTitle(note) : "Loading…"}</span>
        {/* Makes room for the avatars, which sit outside the button so they aren't part of its
            name. */}
        {peers.length > 0 && (
          <PeerAvatarGroup aria-hidden="true">
            {peers.map(({ peerId }) => (
              <span key={peerId} />
            ))}
          </PeerAvatarGroup>
        )}
      </SidebarMenuButton>
      {peers.length > 0 && (
        <SidebarMenuBadge>
          <PeerAvatarGroup>
            {peers.map(({ peerId, user }) => (
              <PeerAvatar key={peerId} hue={user.hue} aria-hidden="true">
                {initials(user.name)}
              </PeerAvatar>
            ))}
          </PeerAvatarGroup>
          <span className="sr-only">
            {names.format(peers.map(({ user }) => user.name))} {peers.length === 1 ? "is" : "are"}{" "}
            here
          </span>
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}
