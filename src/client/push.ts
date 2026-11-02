import {
  PUSH_KEY_API_PATH,
  PUSH_SUBSCRIPTION_API_PATH,
  PUSH_TEST_API_PATH,
  type PushEndpointRequest,
  type PushSubscriptionData,
  type SavePushSubscriptionRequest,
} from "../shared/schema.ts";

/**
 * Whether this device can get notifications:
 * - "supported": it can, though it may not be subscribed yet, or may have blocked them.
 * - "needs-home-screen": an iPhone or iPad, which only lets apps opened from the Home Screen
 *   have notifications.
 * - "development": only production builds have the service worker that shows them.
 * - "unsupported": this browser doesn't do push.
 */
export type PushSupport = "supported" | "needs-home-screen" | "development" | "unsupported";

export function pushSupport(): PushSupport {
  if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) {
    return isAppleMobile() && !isStandalone() ? "needs-home-screen" : "unsupported";
  }
  return import.meta.env.PROD ? "supported" : "development";
}

function isAppleMobile(): boolean {
  // iPads say they're Macs, but Macs don't have touch screens.
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return matchMedia("(display-mode: standalone)").matches;
}

/**
 * This device's subscription, if notifications are on here for whoever is signed in. Only call
 * when pushSupport() is "supported".
 */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  // The browser stays subscribed after logging out, but they're off until someone turns them on.
  return subscription?.endpoint === rememberedEndpoint() ? subscription : null;
}

/** The server's public key, which subscriptions need. Fetch it before the tap that subscribes. */
export async function fetchServerKey(): Promise<string> {
  const response = await fetch(PUSH_KEY_API_PATH);
  const body: unknown = await response.json().catch(() => undefined);
  if (
    !response.ok ||
    typeof body !== "object" ||
    body === null ||
    !("publicKey" in body) ||
    typeof body.publicKey !== "string"
  ) {
    throw new Error(`Couldn’t get ready for notifications (${response.status})`);
  }
  return body.publicKey;
}

/**
 * Asks to show notifications, then subscribes this device and tells the server. Call it straight
 * from a tap, with the key already fetched: Safari only asks during one. Returns whether
 * notifications were allowed.
 */
export async function subscribe(serverKey: string): Promise<boolean> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(serverKey),
  });
  await saveSubscription(subscription);
  return true;
}

export async function unsubscribe(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await send("DELETE", PUSH_SUBSCRIPTION_API_PATH, { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
  forgetEndpoint();
}

export async function sendTestNotification(subscription: PushSubscription): Promise<void> {
  const body: PushEndpointRequest = { endpoint: subscription.endpoint };
  await send("POST", PUSH_TEST_API_PATH, body);
}

/**
 * Tells the server about this device's subscription again, if notifications are on: its time zone
 * may have changed, or the server may have forgotten it. Call at startup.
 */
export async function resaveSubscription(): Promise<void> {
  if (pushSupport() !== "supported" || Notification.permission !== "granted") return;
  const subscription = await currentSubscription();
  if (subscription) await saveSubscription(subscription);
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const body: SavePushSubscriptionRequest = {
    subscription: subscriptionData(subscription),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  await send("POST", PUSH_SUBSCRIPTION_API_PATH, body);
  rememberEndpoint(subscription.endpoint);
}

function subscriptionData(subscription: PushSubscription): PushSubscriptionData {
  const { endpoint, keys } = subscription.toJSON();
  const p256dh = keys?.["p256dh"];
  const auth = keys?.["auth"];
  if (endpoint === undefined || p256dh === undefined || auth === undefined) {
    throw new Error("The browser gave an incomplete push subscription");
  }
  return { endpoint, keys: { p256dh, auth } };
}

async function send(method: string, path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return;
  const error: unknown = await response.json().catch(() => undefined);
  throw new Error(
    typeof error === "object" &&
      error !== null &&
      "error" in error &&
      typeof error.error === "string"
      ? error.error
      : `Something went wrong (${response.status})`,
  );
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

// This device's endpoint while notifications are on, so logging out (which doesn't wait for
// anything) can turn them off.
const ENDPOINT_KEY = "push-endpoint";

function rememberedEndpoint(): string | null {
  try {
    return localStorage.getItem(ENDPOINT_KEY);
  } catch {
    return null;
  }
}

function rememberEndpoint(endpoint: string): void {
  try {
    localStorage.setItem(ENDPOINT_KEY, endpoint);
  } catch {
    // Settings will say they're off, and logging out won't turn them off.
  }
}

function forgetEndpoint(): void {
  try {
    localStorage.removeItem(ENDPOINT_KEY);
  } catch {
    // Nothing was saved, then.
  }
}

/**
 * Turns off this device's notifications when logging out. Doesn't wait: the request goes on while
 * the page leaves. The browser stays subscribed, which turning them on again reuses.
 */
export function stopNotificationsOnLogout(): void {
  const endpoint = rememberedEndpoint();
  if (endpoint === null) return;
  forgetEndpoint();
  const body: PushEndpointRequest = { endpoint };
  void fetch(PUSH_SUBSCRIPTION_API_PATH, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}
