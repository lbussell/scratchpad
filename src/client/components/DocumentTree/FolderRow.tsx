import { FolderIcon, FolderOpenIcon } from "lucide-react";
import { useMemo } from "react";
import {
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { FolderId } from "../../../shared/schema.ts";
import { useAutomergeText } from "../../hooks/useAutomergeText.ts";
import { type FolderNode, folderName, useTree } from "./context.ts";
import { DropIndicator } from "./dragAndDrop.tsx";
import { useDragRow } from "./useDragRow.ts";
import { ItemActions } from "./ItemActions.tsx";
import { DocumentRow } from "./DocumentRow.tsx";

/** A folder's row and, while it's open, the documents in it. */
export function FolderRow({ node }: { node: FolderNode }) {
  const { isCollapsed, setCollapsed, renaming } = useTree();
  const isOpen = !isCollapsed(node.id);
  const { ref, listeners, isDragging, dropPosition } = useDragRow(node.id, {
    isOpenFolder: isOpen,
  });
  const Icon = isOpen ? FolderOpenIcon : FolderIcon;

  return (
    <>
      <SidebarMenuItem ref={ref} isDragging={isDragging} draggable>
        {renaming === node.id ? (
          <FolderNameInput id={node.id} />
        ) : (
          <>
            <SidebarMenuButton
              {...listeners}
              aria-expanded={isOpen}
              onClick={() => setCollapsed(node.id, isOpen)}
            >
              <Icon />
              <span className="flex-1 truncate">{folderName(node.name)}</span>
            </SidebarMenuButton>
            <ItemActions node={node} />
          </>
        )}
        <DropIndicator position={dropPosition} />
      </SidebarMenuItem>
      {isOpen && (
        <li>
          <SidebarMenu nested aria-label={folderName(node.name)}>
            {node.children.length === 0 ? (
              <SidebarMenuItem>
                <SidebarMenuButton render={<div />} size="sm" aria-disabled>
                  <span>Empty</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              // Folders only hold documents.
              node.children.map(
                (child) => child.kind === "document" && <DocumentRow key={child.id} node={child} />,
              )
            )}
          </SidebarMenu>
        </li>
      )}
    </>
  );
}

function FolderNameInput({ id }: { id: FolderId }) {
  const { root, onRenamingChange } = useTree();
  const path = useMemo(() => ["folders", id, "name"], [id]);
  const name = useAutomergeText(root, path);
  const done = () => onRenamingChange(null);

  return (
    <SidebarInput
      {...name}
      aria-label="Folder name"
      placeholder="Untitled folder"
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- the user just asked to name the folder.
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onBlur={done}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "Escape") done();
      }}
    />
  );
}
