import { type AutomergeUrl, isValidAutomergeUrl } from "@automerge/automerge-repo";
import { useSyncExternalStore } from "react";

/** What the main pane shows. Lives in the URL hash so it survives reloads and can be shared. */
export type Route = { page: "home" } | { page: "note"; url: AutomergeUrl } | { page: "settings" };

const SETTINGS_HASH = "settings";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

// Routes are objects, so hand React the hash (a stable string) and parse it during render.
function getHash(): string {
  return decodeURIComponent(location.hash.slice(1));
}

function parseRoute(hash: string): Route {
  if (hash === SETTINGS_HASH) return { page: "settings" };
  if (isValidAutomergeUrl(hash)) return { page: "note", url: hash };
  return { page: "home" };
}

export function routeHref(route: Route): string {
  if (route.page === "settings") return `#${SETTINGS_HASH}`;
  if (route.page === "note") return `#${route.url}`;
  return "#";
}

export function navigate(route: Route): void {
  location.hash = routeHref(route);
}

export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, getHash));
}
