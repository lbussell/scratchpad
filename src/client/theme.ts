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

function applyTheme(): void {
  const isDark = theme === "dark" || (theme === "system" && darkScheme.matches);
  document.documentElement.classList.toggle("dark", isDark);
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

/** Colors the whole app with the user's hue (see styles.css), and remembers it for next time. */
export function applyHue(hue: number): void {
  document.documentElement.style.setProperty("--hue", String(hue));
  try {
    localStorage.setItem(HUE_STORAGE_KEY, String(hue));
  } catch {
    // Only the next page load's first paint misses out.
  }
}
