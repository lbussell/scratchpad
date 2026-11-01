import { useDocument } from "@automerge/automerge-repo-react-hooks";
import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { FolderIcon, SquareTextIcon } from "lucide-react";
import { useState } from "react";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import type { NoteDoc, SidebarItemId } from "../../../shared/schema.ts";
import { noteTitle } from "../../notes.ts";
import { type Drop, dropFor, findNode, type TreeNode } from "../../tree.ts";
import { type DropTarget, DropTargetContext, folderName, useTree } from "./context.ts";

/** Lets the rows inside be dragged onto each other to rearrange the tree. */
export function TreeDragAndDrop({ children }: { children: React.ReactNode }) {
  const { tree, move } = useTree();
  const [dragging, setDragging] = useState<TreeNode | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const sensors = useSensors(
    // A little movement first, so clicks still select.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Touch and hold, so swipes still scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    setDragging(findNode(tree, toItemId(active.id)) ?? null);
  };

  const onDragMove = ({ active, over, activatorEvent, delta }: DragMoveEvent) => {
    const startY = pointerY(activatorEvent);
    if (!over || startY === undefined) {
      setDropTarget(null);
      return;
    }
    const overId = toItemId(over.id);
    const fraction = (startY + delta.y - over.rect.top) / over.rect.height;
    const isOpenFolder = over.data.current?.["isOpenFolder"] === true;
    const drop = dropFor(tree, toItemId(active.id), overId, fraction, isOpenFolder);
    setDropTarget(drop && { ...drop, over: overId });
  };

  const onDragEnd = ({ active }: DragEndEvent) => {
    if (dropTarget) move(toItemId(active.id), dropTarget.placement);
    onDragCancel();
  };

  const onDragCancel = () => {
    setDragging(null);
    setDropTarget(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <DropTargetContext value={dropTarget}>{children}</DropTargetContext>
      <DragOverlay dropAnimation={null}>{dragging && <DragPreview node={dragging} />}</DragOverlay>
    </DndContext>
  );
}

// Dragging is for pointers; each row's menu moves it too, and works with a keyboard.
const announcements = {
  onDragStart: () => "Picked up an item.",
  onDragOver: () => undefined,
  onDragEnd: () => "Moved the item.",
  onDragCancel: () => "Cancelled the move.",
};
const screenReaderInstructions = {
  draggable: "To move this item, use its actions menu.",
};

function toItemId(id: string | number): SidebarItemId {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every draggable's ID is an item
  return String(id) as SidebarItemId;
}

function pointerY(event: Event | null): number | undefined {
  if (event instanceof MouseEvent) return event.clientY;
  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
    return event.touches[0]?.clientY;
  }
  return undefined;
}

/** Shows where a dragged item would land: a line before or after the row, or a ring for into. */
export function DropIndicator({ position }: { position: Drop["position"] | undefined }) {
  if (position === undefined) return null;
  if (position === "into") {
    return (
      <span
        aria-hidden="true"
        data-position={position}
        className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-sidebar-ring"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-position={position}
      className="pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-sidebar-ring data-[position=after]:-bottom-px data-[position=before]:-top-px"
    />
  );
}

/** What follows the pointer while dragging. */
function DragPreview({ node }: { node: TreeNode }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md bg-sidebar-accent px-2 text-sm text-sidebar-accent-foreground shadow-md [&_svg]:size-4 [&_svg]:shrink-0">
      {node.kind === "folder" ? (
        <>
          <FolderIcon />
          <span className="truncate">{folderName(node.name)}</span>
        </>
      ) : (
        <>
          <SquareTextIcon />
          <DocumentName url={node.id} />
        </>
      )}
    </div>
  );
}

function DocumentName({ url }: { url: AutomergeUrl }) {
  const [note] = useDocument<NoteDoc>(url);
  return <span className="truncate">{note ? noteTitle(note) : "Loading…"}</span>;
}
