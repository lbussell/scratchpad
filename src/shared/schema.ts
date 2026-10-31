import type { AutomergeUrl } from "@automerge/automerge-repo";

/** WebSocket path the Automerge sync server listens on. */
export const SYNC_PATH = "/sync";

/** HTTP endpoint that returns a {@link SessionResponse}: what the client needs at startup. */
export const SESSION_API_PATH = "/api/session";

/** HTTP endpoint for the signed-in user's profile. PATCH it with an {@link UpdateProfileRequest}. */
export const PROFILE_API_PATH = "/api/me";

export const MAX_NAME_LENGTH = 80;

/**
 * The colors users can choose: 24 OKLCH hues, 15° apart. Names are for people (labels, screen
 * readers) and only approximate.
 */
export const HUES = [
  { hue: 0, name: "Pink" },
  { hue: 15, name: "Rose" },
  { hue: 30, name: "Red" },
  { hue: 45, name: "Vermilion" },
  { hue: 60, name: "Orange" },
  { hue: 75, name: "Amber" },
  { hue: 90, name: "Gold" },
  { hue: 105, name: "Yellow" },
  { hue: 120, name: "Lime" },
  { hue: 135, name: "Chartreuse" },
  { hue: 150, name: "Green" },
  { hue: 165, name: "Emerald" },
  { hue: 180, name: "Teal" },
  { hue: 195, name: "Cyan" },
  { hue: 210, name: "Sky" },
  { hue: 225, name: "Azure" },
  { hue: 240, name: "Blue" },
  { hue: 255, name: "Cobalt" },
  { hue: 270, name: "Indigo" },
  { hue: 285, name: "Violet" },
  { hue: 300, name: "Purple" },
  { hue: 315, name: "Plum" },
  { hue: 330, name: "Magenta" },
  { hue: 345, name: "Fuchsia" },
] as const;

export function isValidHue(value: unknown): value is number {
  return HUES.some(({ hue }) => hue === value);
}

/** A signed-in user. Stored on the server; each user can only change their own. */
export interface UserProfile {
  /** Stable ID from the auth proxy. */
  id: string;
  email: string;
  name: string;
  /**
   * The user's color, one of {@link HUES}: an OKLCH hue that colors their app and their cursor as
   * others see it. Lightness and chroma come from the client's theme.
   */
  hue: number;
}

export interface SessionResponse {
  rootDocUrl: AutomergeUrl;
  user: UserProfile;
  /** POST here to log out, when the deployment supports it. */
  logoutUrl: string | null;
}

/** The fields to change. */
export interface UpdateProfileRequest {
  name?: string;
  hue?: number;
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
