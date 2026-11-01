import { isValidAutomergeUrl } from "@automerge/automerge-repo";
import {
  isUserProfile,
  PROFILE_API_PATH,
  SESSION_API_PATH,
  type SessionResponse,
  type UpdateProfileRequest,
  type UserProfile,
} from "../shared/schema.ts";

// The last session from the server, so the app can start without a connection.
const STORAGE_KEY = "session";
/** How long to wait for the server at startup before using the saved session instead. */
const STARTUP_TIMEOUT_MS = 4000;

export interface StartupSession {
  session: SessionResponse;
  /** The server didn't answer, so this is the saved session, which may be out of date. */
  isSaved: boolean;
}

/**
 * The session to start the app with: the server's if it answers soon, otherwise the one saved
 * last time. Without either, the app can't start.
 */
export async function loadStartupSession(): Promise<StartupSession> {
  try {
    return { session: await fetchSession(STARTUP_TIMEOUT_MS), isSaved: false };
  } catch (error) {
    // Offline, or the server is slow or down. Anything else (like a bad response) isn't something
    // the saved session should paper over.
    if (!(error instanceof ServerUnreachableError)) throw error;
    const saved = readSavedSession();
    if (!saved) throw error;
    return { session: saved, isSaved: true };
  }
}

export async function fetchSession(timeoutMs?: number): Promise<SessionResponse> {
  let response: Response;
  try {
    response = await fetch(
      SESSION_API_PATH,
      timeoutMs === undefined ? {} : { signal: AbortSignal.timeout(timeoutMs) },
    );
  } catch (error) {
    throw new ServerUnreachableError({ cause: error });
  }
  // A proxy answering for a server that's down.
  if (response.status >= 500) throw new ServerUnreachableError();
  if (response.status === 401) {
    // Signed out since the page loaded. Reloading takes the server's route to the login page.
    location.reload();
  }
  if (!response.ok) throw new Error(`Failed to load the session: ${response.status}`);
  const body: unknown = await response.json();
  if (!isSessionResponse(body)) throw new Error("Server returned an invalid session");
  saveSession(body);
  return body;
}

class ServerUnreachableError extends Error {
  constructor(options?: ErrorOptions) {
    super("Couldn’t reach the server", options);
  }
}

function saveSession(session: SessionResponse): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Only offline starts miss out.
  }
}

/** Forgets the saved session, so the app can't start offline as this user (when logging out). */
export function forgetSavedSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was saved, then.
  }
}

/** Keeps the saved session's profile current, so an offline start shows the latest one. */
function saveProfile(user: UserProfile): void {
  const saved = readSavedSession();
  if (saved) saveSession({ ...saved, user });
}

function readSavedSession(): SessionResponse | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored === null ? undefined : JSON.parse(stored);
    return isSessionResponse(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Saves changes to the signed-in user's profile, returning the updated profile. */
export async function updateProfile(changes: UpdateProfileRequest): Promise<UserProfile> {
  const response = await fetch(PROFILE_API_PATH, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok || !isUserProfile(body)) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `Couldn’t save (${response.status})`;
    throw new Error(message);
  }
  saveProfile(body);
  return body;
}

function isSessionResponse(value: unknown): value is SessionResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "rootDocUrl" in value &&
    typeof value.rootDocUrl === "string" &&
    isValidAutomergeUrl(value.rootDocUrl) &&
    "user" in value &&
    isUserProfile(value.user) &&
    "logoutUrl" in value &&
    (value.logoutUrl === null || typeof value.logoutUrl === "string")
  );
}
