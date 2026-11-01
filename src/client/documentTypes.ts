import type { AutomergeUrl } from "@automerge/automerge-repo";
import { ListTodoIcon, type LucideIcon, SquareTextIcon } from "lucide-react";
import { type ComponentType, lazy } from "react";
import type { BaseDoc, DocumentTypeId, NoteDoc, TodoListDoc } from "../shared/schema.ts";
import { NotePeers } from "./components/NotePeers.tsx";
import { firstLine, newNote } from "./notes.ts";
import { newTodoList } from "./todos.ts";

/**
 * Everything the app needs to know about a type of document. To add a type: add its ID to
 * DOCUMENT_TYPES and its shape to `src/shared/schema.ts`, then add it below.
 */
export interface DocumentType<Doc extends BaseDoc> {
  /** What it's called, as in the New menu: "Note". */
  name: string;
  icon: LucideIcon;
  /** A new, empty document of this type, with a blank title. */
  create: () => Doc;
  /** What to call a document that has no title field at all, if not "Untitled". */
  untitledName?(doc: Doc): string | undefined;
  /** Shows and edits the document, below its title. */
  Editor: ComponentType<{ url: AutomergeUrl }>;
  /** Shows who else has the document open, beside its title. Their avatars, if not given. */
  Peers?: ComponentType<{ url: AutomergeUrl }>;
}

interface DocumentsByType {
  note: NoteDoc;
  "todo-list": TodoListDoc;
}

export const documentTypes: { [Id in DocumentTypeId]: DocumentType<DocumentsByType[Id]> } = {
  note: {
    name: "Note",
    icon: SquareTextIcon,
    create: newNote,
    // Notes from before titles existed were named after their first line.
    untitledName: (note) => firstLine(note.text),
    // CodeMirror is a large share of the bundle and isn't needed until a note is open.
    Editor: lazy(async () => ({
      default: (await import("./components/NoteEditor.tsx")).NoteEditor,
    })),
    Peers: NotePeers,
  },
  "todo-list": {
    name: "To-do list",
    icon: ListTodoIcon,
    create: newTodoList,
    Editor: lazy(async () => ({
      default: (await import("./components/TodoList/TodoListEditor.tsx")).TodoListEditor,
    })),
  },
};

/** In the order the New menu lists them. */
export const documentTypeIds = Object.keys(documentTypes).filter(isDocumentTypeId);

export function isDocumentTypeId(id: unknown): id is DocumentTypeId {
  return typeof id === "string" && Object.hasOwn(documentTypes, id);
}

/**
 * The document's type, or undefined if it's a type this version of the app doesn't know, made by
 * a newer one. Documents without a type are notes, from before there were types.
 */
export function documentTypeOf(doc: BaseDoc): DocumentType<BaseDoc> | undefined {
  const id = doc.type ?? "note";
  return isDocumentTypeId(id) ? documentTypes[id] : undefined;
}

/** What the sidebar calls the document: its title, or "Untitled" if that's blank. */
export function documentTitle(doc: BaseDoc): string {
  const title = (doc.title ?? documentTypeOf(doc)?.untitledName?.(doc) ?? "").trim();
  return title === "" ? "Untitled" : title;
}
