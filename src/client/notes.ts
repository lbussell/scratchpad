import type { NoteDoc } from "../shared/schema.ts";

export function newNote(): NoteDoc {
  return { type: "note", title: "", text: "", createdAt: Date.now() };
}

/** The first non-blank line of the text, if there is one. */
export function firstLine(text: string): string | undefined {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "");
}
