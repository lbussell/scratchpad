import type { AutomergeUrl } from "@automerge/automerge-repo";

/** WebSocket path the Automerge sync server listens on. */
export const SYNC_PATH = "/sync";

/** HTTP endpoint that returns a {@link SessionResponse}: what the client needs at startup. */
export const SESSION_API_PATH = "/api/session";

/** HTTP endpoint for the signed-in user's profile. PATCH it with an {@link UpdateProfileRequest}. */
export const PROFILE_API_PATH = "/api/me";

export const MAX_NAME_LENGTH = 80;

/** A signed-in user. Stored on the server; each user can only change their own. */
export interface UserProfile {
  /** Stable ID from the auth proxy. */
  id: string;
  email: string;
  name: string;
  /** OKLCH hue for this user's cursor. Lightness and chroma come from the client's theme. */
  hue: number;
}

export interface SessionResponse {
  rootDocUrl: AutomergeUrl;
  user: UserProfile;
  /** POST here to log out, when the deployment supports it. */
  logoutUrl: string | null;
}

export interface UpdateProfileRequest {
  name: string;
}

/** The trimmed name, or undefined if it's blank or too long. */
export function normalizeName(name: string): string | undefined {
  const trimmed = name.trim();
  return trimmed !== "" && trimmed.length <= MAX_NAME_LENGTH ? trimmed : undefined;
}

export function isUserProfile(value: unknown): value is UserProfile {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "hue" in value &&
    typeof value.hue === "number" &&
    Number.isFinite(value.hue)
  );
}

/** The single document every user shares. It indexes all the notes. */
export interface RootDoc {
  /** Newest first. */
  notes: AutomergeUrl[];
}

export interface NoteDoc {
  /** Missing on notes created before titles existed. */
  title?: string;
  text: string;
  createdAt: number;
}
