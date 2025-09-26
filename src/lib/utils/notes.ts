import type { Note } from "@/lib/types";

export function notesHaveContent(notes: Note[]): boolean {
  return notes.some((note) => note.text.trim().length > 0);
}
