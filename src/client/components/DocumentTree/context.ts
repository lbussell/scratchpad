import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { createContext, use } from "react";
import type { FolderId, RootDoc, SidebarItemId } from "../../../shared/schema.ts";
import type { WorkspacePeer } from "../../presence.ts";
import type { Drop, Placement, TreeNode } from "../../tree.ts";

export type DocumentNode = Extract<TreeNode, { kind: "document" }>;
export type FolderNode = Extract<TreeNode, { kind: "folder" }>;

/** What every row in the tree needs: the tree itself, who's where, and what rows can do. */
export interface TreeContextValue {
  tree: readonly TreeNode[];
  root: DocHandle<RootDoc>;
  selected: AutomergeUrl | undefined;
  onSelect: (url: AutomergeUrl) => void;
  /** Who else has each document open. */
  peers: ReadonlyMap<AutomergeUrl, readonly WorkspacePeer[]>;
  /** The folder whose name is being edited. */
  renaming: FolderId | null;
  onRenamingChange: (id: FolderId | null) => void;
  isCollapsed: (id: FolderId) => boolean;
  setCollapsed: (id: FolderId, collapsed: boolean) => void;
  move: (id: SidebarItemId, placement: Placement) => void;
  /** Creates a note in the folder and opens it. */
  createNote: (parent: FolderId) => void;
  /** Asks to confirm, then deletes. */
  requestDelete: (node: TreeNode) => void;
}

export const TreeContext = createContext<TreeContextValue | null>(null);

export function useTree(): TreeContextValue {
  const context = use(TreeContext);
  if (!context) throw new Error("useTree must be used inside DocumentTree");
  return context;
}

export function folderName(name: string): string {
  return name.trim() === "" ? "Untitled folder" : name;
}

/** Where a dragged item would land, and over which row. */
export type DropTarget = Drop & { over: SidebarItemId };

/** Set while dragging, inside TreeDragAndDrop. */
export const DropTargetContext = createContext<DropTarget | null>(null);
