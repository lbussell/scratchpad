import { isValidAutomergeUrl } from "@automerge/automerge-repo";
import {
  isUserProfile,
  PROFILE_API_PATH,
  SESSION_API_PATH,
  type SessionResponse,
  type UpdateProfileRequest,
  type UserProfile,
} from "../shared/schema.ts";
import { devTabHeaders } from "./devTab.ts";

export async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch(SESSION_API_PATH, { headers: devTabHeaders });
  if (response.status === 401) {
    // Signed out since the page loaded. Reloading takes the server's route to the login page.
    location.reload();
  }
  if (!response.ok) throw new Error(`Failed to load the session: ${response.status}`);
  const body: unknown = await response.json();
  if (!isSessionResponse(body)) throw new Error("Server returned an invalid session");
  return body;
}

/** Saves changes to the signed-in user's profile, returning the updated profile. */
export async function updateProfile(changes: UpdateProfileRequest): Promise<UserProfile> {
  const response = await fetch(PROFILE_API_PATH, {
    method: "PATCH",
    headers: { ...devTabHeaders, "Content-Type": "application/json" },
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
