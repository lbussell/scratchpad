import {
  ArrowDownIcon,
  ArrowUpIcon,
  FolderIcon,
  FolderInputIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react";
import { useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuAction } from "@/components/ui/sidebar";
import { findSiblings, type TreeNode } from "../../tree.ts";
import { type FolderNode, folderName, useTree } from "./context.ts";

/** A row's "⋯" menu. Everything dragging does, it does too, for keyboards and screen readers. */
export function ItemActions({ node }: { node: TreeNode }) {
  const { tree, move, createNote, onRenamingChange, requestDelete } = useTree();
  const location = findSiblings(tree, node.id);
  const parent = location?.parent ?? null;
  const siblings = location?.siblings ?? [];
  const index = siblings.findIndex((sibling) => sibling.id === node.id);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];
  // Folders only hold documents, so only documents move into them.
  const destinations =
    node.kind === "document"
      ? tree.filter((item): item is FolderNode => item.kind === "folder" && item.id !== parent)
      : [];
  // The menu puts focus back on its button as it closes, which would take it from a new note's
  // title or a folder name being edited.
  const movesFocus = useRef(false);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) movesFocus.current = false;
      }}
    >
      <DropdownMenuTrigger
        render={
          <SidebarMenuAction
            showOnHover
            aria-label={node.kind === "document" ? "Document actions" : "Folder actions"}
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        width="auto"
        finalFocus={() => !movesFocus.current}
      >
        {node.kind === "folder" && (
          <>
            <DropdownMenuItem
              onClick={() => {
                movesFocus.current = true;
                createNote(node.id);
              }}
            >
              <SquarePenIcon />
              New note
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                movesFocus.current = true;
                onRenamingChange(node.id);
              }}
            >
              <PencilIcon />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          disabled={!previous}
          onClick={() => previous && move(node.id, { parent, before: previous.id })}
        >
          <ArrowUpIcon />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!next}
          onClick={() => next && move(node.id, { parent, after: next.id })}
        >
          <ArrowDownIcon />
          Move down
        </DropdownMenuItem>
        {(parent !== null || destinations.length > 0) && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInputIcon />
              Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {parent !== null && (
                <DropdownMenuItem onClick={() => move(node.id, { parent: null, at: "end" })}>
                  Top level
                </DropdownMenuItem>
              )}
              {destinations.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => move(node.id, { parent: folder.id, at: "end" })}
                >
                  <FolderIcon />
                  {folderName(folder.name)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => requestDelete(node)}>
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
