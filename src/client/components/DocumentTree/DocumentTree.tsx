import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocHandle, useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { useCallback, useMemo, useState } from "react";
import { SidebarGroupContent, SidebarMenu } from "@/components/ui/sidebar";
import type { FolderId, NoteDoc, RootDoc, SidebarItemId } from "../../../shared/schema.ts";
import { useCollapsedFolders } from "../../hooks/useCollapsedFolders.ts";
import { newNote } from "../../notes.ts";
import type { WorkspacePeer } from "../../presence.ts";
import {
  addDocument,
  buildTree,
  deleteItem,
  moveItem,
  type Placement,
  type TreeNode,
} from "../../tree.ts";
import { TreeContext, type TreeContextValue } from "./context.ts";
import { DeleteDialog } from "./DeleteDialog.tsx";
import { TreeDragAndDrop } from "./dragAndDrop.tsx";
import { FolderRow } from "./FolderRow.tsx";
import { DocumentRow } from "./DocumentRow.tsx";

interface DocumentTreeProps {
  rootDocUrl: AutomergeUrl;
  selected: AutomergeUrl | undefined;
  onSelect: (url: AutomergeUrl) => void;
  /** Called after deleting the document that's open. */
  onDeleteSelected: () => void;
  /** Who else has each document open. */
  peers: ReadonlyMap<AutomergeUrl, readonly WorkspacePeer[]>;
  /** The folder whose name is being edited, such as one just created. */
  renaming: FolderId | null;
  onRenamingChange: (id: FolderId | null) => void;
}

/** The sidebar's documents and folders. Drag rows to rearrange them, or use each row's menu. */
export function DocumentTree({
  rootDocUrl,
  selected,
  onSelect,
  onDeleteSelected,
  peers,
  renaming,
  onRenamingChange,
}: DocumentTreeProps) {
  const repo = useRepo();
  const root = useDocHandle<RootDoc>(rootDocUrl, { suspense: true });
  const [rootDoc] = useDocument<RootDoc>(rootDocUrl, { suspense: true });
  const tree = useMemo(() => buildTree(rootDoc), [rootDoc]);
  const [isCollapsed, setCollapsed] = useCollapsedFolders();
  const [pendingDelete, setPendingDelete] = useState<TreeNode | null>(null);

  const move = useCallback(
    (id: SidebarItemId, placement: Placement) => {
      root.change((doc) => moveItem(doc, id, placement));
      // Show where it went.
      if (placement.parent !== null) setCollapsed(placement.parent, false);
    },
    [root, setCollapsed],
  );

  const createNote = useCallback(
    (parent: FolderId) => {
      const note = repo.create<NoteDoc>(newNote());
      root.change((doc) => addDocument(doc, note.url, parent));
      setCollapsed(parent, false);
      onSelect(note.url);
    },
    [repo, root, setCollapsed, onSelect],
  );

  const context = useMemo<TreeContextValue>(
    () => ({
      tree,
      root,
      selected,
      onSelect,
      peers,
      renaming,
      onRenamingChange,
      isCollapsed,
      setCollapsed,
      move,
      createNote,
      requestDelete: setPendingDelete,
    }),
    [
      tree,
      root,
      selected,
      onSelect,
      peers,
      renaming,
      onRenamingChange,
      isCollapsed,
      setCollapsed,
      move,
      createNote,
    ],
  );

  const confirmDelete = () => {
    if (!pendingDelete) return;
    let deleted: AutomergeUrl[] = [];
    root.change((doc) => {
      deleted = deleteItem(doc, pendingDelete.id);
    });
    setPendingDelete(null);
    if (selected !== undefined && deleted.includes(selected)) onDeleteSelected();
  };

  return (
    <TreeContext value={context}>
      <TreeDragAndDrop>
        <SidebarGroupContent>
          <SidebarMenu>
            {tree.map((node) =>
              node.kind === "document" ? (
                <DocumentRow key={node.id} node={node} />
              ) : (
                <FolderRow key={node.id} node={node} />
              ),
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </TreeDragAndDrop>
      <DeleteDialog
        node={pendingDelete}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </TreeContext>
  );
}
