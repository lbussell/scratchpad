import type { AutomergeUrl } from "@automerge/automerge-repo";

/** WebSocket path the Automerge sync server listens on. */
export const SYNC_PATH = "/sync";

/** HTTP endpoint that returns the URL of the shared root document. */
export const ROOT_DOC_API_PATH = "/api/root";

export interface RootDocResponse {
  url: AutomergeUrl;
}

/** The single document every user shares. It indexes all the notes. */
export interface RootDoc {
  /** Newest first. */
  notes: AutomergeUrl[];
}

export interface NoteDoc {
  text: string;
  createdAt: number;
}
