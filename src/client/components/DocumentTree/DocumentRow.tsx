import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { PeerAvatarGroup } from "@/components/ui/peer";
import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { BaseDoc } from "../../../shared/schema.ts";
import { documentTitle } from "../../documentTypes.ts";
import { DocumentIcon } from "../DocumentIcon.tsx";
import { PeopleHere } from "../PeopleHere.tsx";
import type { WorkspacePeer } from "../../presence.ts";
import { type DocumentNode, useTree } from "./context.ts";
import { DropIndicator } from "./dragAndDrop.tsx";
import { useDragRow } from "./useDragRow.ts";
import { ItemActions } from "./ItemActions.tsx";

const nobody: readonly WorkspacePeer[] = [];

export function DocumentRow({ node }: { node: DocumentNode }) {
  const url = node.id;
  const { selected, onSelect, peers: allPeers } = useTree();
  // Not suspending, so one slow document doesn't block the whole list.
  const [doc] = useDocument<BaseDoc>(url);
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
        <DocumentIcon doc={doc} />
        <span className="flex-1 truncate">{doc ? documentTitle(doc) : "Loading…"}</span>
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
      <PeopleHere peers={peers} />
    </SidebarMenuBadge>
  );
}
