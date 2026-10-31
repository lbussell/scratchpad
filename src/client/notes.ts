import type { NoteDoc } from "../shared/schema.ts";

export function newNote(): NoteDoc {
  return { text: "", createdAt: Date.now() };
}

/** A note's title is its first non-blank line. */
export function noteTitle(note: NoteDoc): string {
  const firstLine = note.text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "");
  return firstLine ?? "Untitled";
}
