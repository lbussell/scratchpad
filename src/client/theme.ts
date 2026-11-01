import type { Color } from "../shared/schema.ts";

export type Theme = "light" | "dark" | "system";

// index.html reads the same key to apply the theme before first paint.
const STORAGE_KEY = "theme";
const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Storage can be unavailable, e.g. when blocked by the browser.
  }
  return "system";
}

let theme = readStoredTheme();
syncThemeColor();

function applyTheme(): void {
  const isDark = theme === "dark" || (theme === "system" && darkScheme.matches);
  document.documentElement.classList.toggle("dark", isDark);
  syncThemeColor();
}

/** Matches the browser's and the installed app's status bar to the page background. */
function syncThemeColor(): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", getComputedStyle(document.body).backgroundColor);
}

function update(next: Theme): void {
  theme = next;
  applyTheme();
  for (const listener of listeners) listener();
}

darkScheme.addEventListener("change", applyTheme);
// Follow changes made in other tabs.
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) update(readStoredTheme());
});

export function getTheme(): Theme {
  return theme;
}

export function setTheme(next: Theme): void {
  try {
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Still apply it for this page.
  }
  update(next);
}

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// index.html reads this too, to color the page before the session arrives.
const HUE_STORAGE_KEY = "hue";

/**
 * Colors the whole app with the user's hue, or grays for Neutral (null), and remembers it for
 * next time. See styles.css.
 */
export function applyColor(hue: Color): void {
  const { style } = document.documentElement;
  style.setProperty("--tint", hue === null ? "0" : "1");
  if (hue !== null) style.setProperty("--hue", String(hue));
  syncThemeColor();
  try {
    localStorage.setItem(HUE_STORAGE_KEY, hue === null ? "neutral" : String(hue));
  } catch {
    // Only the next page load's first paint misses out.
  }
}
