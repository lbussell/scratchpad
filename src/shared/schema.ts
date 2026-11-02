import type { AutomergeUrl } from "@automerge/automerge-repo";

/** WebSocket path the Automerge sync server listens on. */
export const SYNC_PATH = "/sync";

/** HTTP endpoint that returns a {@link SessionResponse}: what the client needs at startup. */
export const SESSION_API_PATH = "/api/session";

/** HTTP endpoint for the signed-in user's profile. PATCH it with an {@link UpdateProfileRequest}. */
export const PROFILE_API_PATH = "/api/me";

/** HTTP endpoint that lists everyone who has signed in, as {@link Person}s. */
export const USERS_API_PATH = "/api/users";

/** HTTP endpoint that returns the server's {@link PushKeyResponse}, for subscribing to push. */
export const PUSH_KEY_API_PATH = "/api/push/key";

/**
 * HTTP endpoint for this device's push subscription: POST a {@link SavePushSubscriptionRequest},
 * or DELETE a {@link PushEndpointRequest}.
 */
export const PUSH_SUBSCRIPTION_API_PATH = "/api/push/subscription";

/** HTTP endpoint that sends a test notification. POST a {@link PushEndpointRequest}. */
export const PUSH_TEST_API_PATH = "/api/push/test";

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

/** A user's color: one of {@link HUES}, or null for Neutral (grays, no hue). */
export type Color = number | null;

export function isValidColor(value: unknown): value is Color {
  return value === null || HUES.some(({ hue }) => hue === value);
}

/** How other people in a note appear beside its title: little eyes, or their initials. */
export const PEER_STYLES = ["eyes", "initials"] as const;
export type PeerStyle = (typeof PEER_STYLES)[number];

export function isPeerStyle(value: unknown): value is PeerStyle {
  return PEER_STYLES.some((style) => style === value);
}

/** A signed-in user. Stored on the server; each user can only change their own. */
export interface UserProfile {
  /** Stable ID from the auth proxy. */
  id: string;
  email: string;
  name: string;
  /**
   * The user's color, one of {@link HUES} or null for Neutral: an OKLCH hue that colors their app
   * and their cursor as others see it. Lightness and chroma come from the client's theme.
   */
  hue: Color;
  /** How this user sees other people in a note. */
  peerStyle: PeerStyle;
  /** When to remind this user of to-dos due on a day without a time, in their time zone. */
  reminderTime: TimeOfDay;
}

/** What anyone may see of a user: enough to show them, as in presence or a to-do's assignee. */
export type Person = Pick<UserProfile, "id" | "name" | "hue">;

export function isPerson(value: unknown): value is Person {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "hue" in value &&
    (value.hue === null || (typeof value.hue === "number" && Number.isFinite(value.hue)))
  );
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
  hue?: Color;
  peerStyle?: PeerStyle;
  reminderTime?: TimeOfDay;
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
    (value.hue === null || (typeof value.hue === "number" && Number.isFinite(value.hue))) &&
    "peerStyle" in value &&
    isPeerStyle(value.peerStyle) &&
    "reminderTime" in value &&
    isTimeOfDay(value.reminderTime)
  );
}

/** A time on the clock, `HH:MM` (24-hour), wherever the person it's for is. */
export type TimeOfDay = string;

export function isTimeOfDay(value: unknown): value is TimeOfDay {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** When reminders come for to-dos due on a day without a time, until someone picks another. */
export const DEFAULT_REMINDER_TIME: TimeOfDay = "06:00";

export interface PushKeyResponse {
  /** The server's VAPID public key, base64url-encoded: `applicationServerKey` for subscribing. */
  publicKey: string;
}

/** A browser's push subscription, as `PushSubscription.toJSON()` gives it. */
export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface SavePushSubscriptionRequest {
  subscription: PushSubscriptionData;
  /** The device's IANA time zone, which its reminders' times are in. */
  timeZone: string;
}

export interface PushEndpointRequest {
  endpoint: string;
}

/** What a push message carries, for the service worker to show as a notification. */
export interface PushPayload {
  title: string;
  body: string;
  /** Opened when the notification is tapped. */
  url: string;
  /** A notification with the same tag replaces the last one. */
  tag: string;
}

/**
 * The version of the root document's shape that this code reads and writes. The server migrates
 * older root documents up to it at startup (`src/server/migrations.ts`); clients won't touch a root
 * document of any other version. Raise it, with a migration, when a change to RootDoc would trip up
 * code that expects the old shape.
 */
export const SCHEMA_VERSION = 1;

/** A root document's version. Root documents from before versions existed are version 0. */
export function schemaVersionOf(root: object): number {
  return "schemaVersion" in root && typeof root.schemaVersion === "number" ? root.schemaVersion : 0;
}

/**
 * Whether code at SCHEMA_VERSION can use a root document: "newer" if the code is out of date
 * (reload to update it), "older" if the server hasn't migrated the document yet.
 */
export function schemaCompatibility(root: object): "compatible" | "newer" | "older" {
  const version = schemaVersionOf(root);
  if (version === SCHEMA_VERSION) return "compatible";
  return version > SCHEMA_VERSION ? "newer" : "older";
}

/** The single document every user shares. It indexes all the other documents. */
export interface RootDoc {
  /** Which version of this shape the document has: {@link SCHEMA_VERSION}, once migrated. */
  schemaVersion: number;
  /** Every document, newest first. Where each one sits in the sidebar is in `positions`. */
  documents: AutomergeUrl[];
  /** Where each document and folder sits in the sidebar. */
  positions: Record<SidebarItemId, SidebarPosition>;
  folders: Record<FolderId, Folder>;
}

/** Folder IDs have a prefix, so they can't be mistaken for document URLs. */
export type FolderId = `folder:${string}`;

/** What the sidebar lists: a document or a folder. */
export type SidebarItemId = AutomergeUrl | FolderId;

export interface SidebarPosition {
  /** The folder it's in, or null for the top level. Folders only hold documents, not other folders. */
  parent: FolderId | null;
  /**
   * A fractional index: siblings sort by it (then by ID, for ties from concurrent moves), so moving
   * an item only changes the item.
   */
  order: string;
}

export interface Folder {
  name: string;
}

export function isFolderId(id: string): id is FolderId {
  return id.startsWith("folder:");
}

/**
 * The types of document. Each document says which it is in its `type` field, except notes from
 * before there were types, which have none. The client's registry of types is
 * `src/client/documentTypes.ts`.
 */
export const DOCUMENT_TYPES = ["note", "todo-list"] as const;
export type DocumentTypeId = (typeof DOCUMENT_TYPES)[number];

/**
 * What every document has, whatever its type. `type` is a string rather than a DocumentTypeId
 * because a newer client may have created a type this code doesn't know.
 */
export interface BaseDoc {
  type?: string;
  /** Edited in place above the document. Missing on notes created before titles existed. */
  title?: string;
  createdAt: number;
}

/** A note: a title and text. */
export interface NoteDoc extends BaseDoc {
  /** Missing on notes created before there were types of document. */
  type?: "note";
  text: string;
}

/** A to-do list. */
export interface TodoListDoc extends BaseDoc {
  type: "todo-list";
  title: string;
  /** Keyed by ID, so edits find the right to-do even while others are added or deleted. */
  todos: Record<string, Todo>;
}

export interface Todo {
  text: string;
  /** Milliseconds since the epoch. Open to-dos are listed in the order they were added. */
  createdAt: number;
  /** The ID of the user it's assigned to, if anyone. Reminders go to them, or else to everyone. */
  assignee?: string;
  /**
   * The day it's due, as `YYYY-MM-DD`: a day wherever you are, "due Friday". Every to-do gets one
   * when it's added. To-dos from before that may have none, and count as due the day they were
   * added.
   */
  due?: string;
  /**
   * When on that day to be reminded, as a {@link TimeOfDay}. Without one, reminders come at each
   * person's own reminder time.
   */
  time?: TimeOfDay;
  /** When it was marked done, in milliseconds since the epoch. Missing while it's open. */
  doneAt?: number;
}
