import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { NoteDoc } from "../../../shared/schema.ts";
import { noteTitle } from "../../notes.ts";
import type { TreeNode } from "../../tree.ts";
import { folderName } from "./context.ts";

interface DeleteDialogProps {
  /** What to delete, or null when the dialog is closed. */
  node: TreeNode | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before deleting a document, or a folder and the documents in it. */
export function DeleteDialog({ node, onConfirm, onCancel }: DeleteDialogProps) {
  // Keeps showing the last item while the dialog animates closed.
  const [shown, setShown] = useState(node);
  if (node !== null && node !== shown) setShown(node);

  return (
    <AlertDialog open={node !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>{shown && <DeleteDialogText node={shown} />}</AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteDialogText({ node }: { node: TreeNode }) {
  const [note] = useDocument<NoteDoc>(node.kind === "document" ? node.id : undefined);
  if (node.kind === "document") {
    return (
      <>
        <AlertDialogTitle>Delete “{note ? noteTitle(note) : "this document"}”?</AlertDialogTitle>
        <AlertDialogDescription>It will be deleted for everyone.</AlertDialogDescription>
      </>
    );
  }
  const count = node.children.length;
  return (
    <>
      <AlertDialogTitle>Delete “{folderName(node.name)}”?</AlertDialogTitle>
      <AlertDialogDescription>
        {count > 0
          ? `The ${count} ${count === 1 ? "document" : "documents"} in it will be deleted too, for everyone.`
          : "It will be deleted for everyone."}
      </AlertDialogDescription>
    </>
  );
}
