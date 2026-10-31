import type { NoteDoc } from "../shared/schema.ts";

export function newNote(): NoteDoc {
  return { title: "", text: "", createdAt: Date.now() };
}

/**
 * The note's title, or "Untitled" if it's blank. Notes from before titles existed fall back to
 * their first non-blank line, which is how they used to be named.
 */
export function noteTitle(note: NoteDoc): string {
  const title = (note.title ?? firstLine(note.text) ?? "").trim();
  return title === "" ? "Untitled" : title;
}

function firstLine(text: string): string | undefined {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "");
}
