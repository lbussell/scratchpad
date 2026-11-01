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
