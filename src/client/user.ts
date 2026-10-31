/** Identifies this browser to collaborators. Shared by its tabs, kept across visits. */
export interface User {
  /** OKLCH hue for this user's cursor; lightness and chroma come from the theme. */
  hue: number;
}

const STORAGE_KEY = "user";

export function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "hue" in value &&
    typeof value.hue === "number" &&
    Number.isFinite(value.hue)
  );
}

function loadUser(): User {
  const user: User = { hue: Math.floor(Math.random() * 360) };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (isUser(stored)) return stored;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Storage is unavailable: use a new color for this page.
  }
  return user;
}

export const localUser = loadUser();
