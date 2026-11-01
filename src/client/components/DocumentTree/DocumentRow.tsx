import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { SquareTextIcon } from "lucide-react";
import { PeerAvatar, PeerAvatarGroup } from "@/components/ui/peer";
import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { NoteDoc } from "../../../shared/schema.ts";
import { initials } from "../../initials.ts";
import { noteTitle } from "../../notes.ts";
import type { WorkspacePeer } from "../../presence.ts";
import { type DocumentNode, useTree } from "./context.ts";
import { DropIndicator } from "./dragAndDrop.tsx";
import { useDragRow } from "./useDragRow.ts";
import { ItemActions } from "./ItemActions.tsx";

const nobody: readonly WorkspacePeer[] = [];
const names = new Intl.ListFormat(undefined, { type: "conjunction" });

export function DocumentRow({ node }: { node: DocumentNode }) {
  const url = node.id;
  const { selected, onSelect, peers: allPeers } = useTree();
  // Not suspending, so one slow document doesn't block the whole list.
  const [note] = useDocument<NoteDoc>(url);
  const { setOpenMobile } = useSidebar();
  const { ref, listeners, isDragging, dropPosition } = useDragRow(url);
  const isSelected = url === selected;
  const peers = allPeers.get(url) ?? nobody;

  return (
    <SidebarMenuItem ref={ref} isDragging={isDragging} draggable>
      <SidebarMenuButton
        {...listeners}
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
      <ItemActions node={node} />
      {peers.length > 0 && <PeersBadge peers={peers} />}
      <DropIndicator position={dropPosition} />
    </SidebarMenuItem>
  );
}

/** Who else has the document open. */
function PeersBadge({ peers }: { peers: readonly WorkspacePeer[] }) {
  return (
    <SidebarMenuBadge>
      <PeerAvatarGroup>
        {peers.map(({ peerId, user }) => (
          <PeerAvatar key={peerId} hue={user.hue} aria-hidden="true">
            {initials(user.name)}
          </PeerAvatar>
        ))}
      </PeerAvatarGroup>
      <span className="sr-only">
        {names.format(peers.map(({ user }) => user.name))} {peers.length === 1 ? "is" : "are"} here
      </span>
    </SidebarMenuBadge>
  );
}
