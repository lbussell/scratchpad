// The service worker, which lets the installed app open without a connection. Documents are already
// stored on the device by Automerge (IndexedDB); this caches the app itself. Only registered in
// production builds (main.tsx).
import { clientsClaim } from "workbox-core";
import {
  addRoute,
  cleanupOutdatedCaches,
  matchPrecache,
  precache,
  type PrecacheEntry,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import type { PushPayload } from "../shared/schema.ts";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | PrecacheEntry)[];
};

/** How long to wait for the server before opening the app from the cache instead. */
const NETWORK_TIMEOUT_MS = 3000;

// Every file in the build, filled in by vite-plugin-pwa. A new deploy installs a new worker,
// which takes over right away; the page that's open keeps running the code it loaded.
// oxlint-disable-next-line no-underscore-dangle -- The name vite-plugin-pwa looks for.
precache(self.__WB_MANIFEST);
cleanupOutdatedCaches();
void self.skipWaiting();
clientsClaim();

// Pages come from the network first, so the server (and the auth proxy in front of it) still
// decide what a visit gets: the latest app, or the login page for someone signed out. Only when
// the server can't be reached does the app open from the cache. Registered before the precache
// route, which would otherwise answer "/" with the cached index.html.
registerRoute(
  new NavigationRoute(async ({ request }) => {
    try {
      const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
      // A proxy answering for a server that's down.
      if (response.status < 500) return response;
    } catch {
      // Offline, or too slow to wait for.
    }
    return (await matchPrecache("index.html")) ?? Response.error();
  }),
);
addRoute();

// Reminders, sent by the server (src/server/reminders.ts). Every push must show a notification:
// Safari takes away the subscription of a site whose pushes show nothing.
self.addEventListener("push", (event) => {
  const payload = parsePayload(event.data);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url },
      icon: "/icon-192.png",
    }),
  );
});

// Tapping a notification opens what it's about, in the app if it's already open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data: unknown = event.notification.data;
  const url =
    typeof data === "object" && data !== null && "url" in data && typeof data.url === "string"
      ? data.url
      : "/";
  event.waitUntil(openApp(new URL(url, self.location.origin).href));
});

async function openApp(url: string): Promise<void> {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = windows[0];
  if (!open) {
    await self.clients.openWindow(url);
    return;
  }
  await open.focus();
  // The page follows the hash itself (main.tsx), without reloading.
  // A client's postMessage has no target origin: it's always this one.
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  open.postMessage({ type: "open", url });
}

function parsePayload(data: PushMessageData | null): PushPayload {
  const fallback = { title: "Scratchpad", body: "", url: "/", tag: "scratchpad" };
  try {
    const value: unknown = data?.json();
    if (typeof value !== "object" || value === null) return fallback;
    const field = (key: keyof PushPayload) =>
      key in value && typeof Reflect.get(value, key) === "string"
        ? String(Reflect.get(value, key))
        : fallback[key];
    return { title: field("title"), body: field("body"), url: field("url"), tag: field("tag") };
  } catch {
    return fallback;
  }
}

async function fetchWithTimeout(request: Request, ms: number): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Timed out")), ms);
  });
  try {
    return await Promise.race([fetch(request), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
