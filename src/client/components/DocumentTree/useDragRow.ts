import { useDraggable, useDroppable } from "@dnd-kit/core";
import { use, useCallback } from "react";
import type { SidebarItemId } from "../../../shared/schema.ts";
import { DropTargetContext } from "./context.ts";

/**
 * Makes a row draggable and a place to drop. Spread `listeners` on the row's button, put `ref` on
 * the row, and render a DropIndicator at `dropPosition` inside it to show where a drop would land.
 */
export function useDragRow(id: SidebarItemId, { isOpenFolder = false } = {}) {
  const { setNodeRef: setDragRef, listeners, isDragging } = useDraggable({ id });
  const { setNodeRef: setDropRef } = useDroppable({ id, data: { isOpenFolder } });
  const dropTarget = use(DropTargetContext);
  const ref = useCallback(
    (element: HTMLElement | null) => {
      setDragRef(element);
      setDropRef(element);
    },
    [setDragRef, setDropRef],
  );
  const position = dropTarget?.over === id ? dropTarget.position : undefined;
  return { ref, listeners, isDragging, dropPosition: position };
}
