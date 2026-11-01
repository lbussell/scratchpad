/**
 * In development, each browser tab is its own user, so one person can try out collaboration:
 * the tab keeps a random ID for as long as it's open (surviving reloads), and the server picks a
 * user for it (see devTabUser in src/server/auth.ts). Production builds drop this, and the
 * server ignores it there.
 */
function devTab(): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  try {
    let tab = sessionStorage.getItem("devTab");
    if (tab === null) {
      tab = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      sessionStorage.setItem("devTab", tab);
    }
    return tab;
  } catch {
    return undefined;
  }
}

const tab = devTab();

/** Headers that identify this tab's user, for API requests. */
export const devTabHeaders: Record<string, string> = tab === undefined ? {} : { "X-Dev-Tab": tab };

/** Identifies this tab's user on a WebSocket URL, which can't carry headers. */
export function withDevTab(url: URL): URL {
  if (tab !== undefined) url.searchParams.set("devTab", tab);
  return url;
}
