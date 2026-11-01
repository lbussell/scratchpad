import type { IncomingMessage } from "node:http";

/**
 * Who a request is from, as asserted by the auth proxy in front of the app. Only trustworthy if
 * the app is unreachable except through that proxy.
 */
export interface Identity {
  id: string;
  email: string;
}

export interface AuthConfig {
  /** Lowercase header names carrying the user's stable ID and email. */
  userIdHeader: string;
  emailHeader: string;
  /** Where to send signed-out visitors. `{path}` is replaced with the page they wanted. */
  loginUrl: string | undefined;
  /** Where the client POSTs to log out. */
  logoutUrl: string | undefined;
  /**
   * Used when a request has no identity headers. Only set outside production, where it also
   * turns on per-tab users (see devTabUser).
   */
  devUser: Identity | undefined;
}

/** Names for development users, one picked per browser tab. */
const DEV_NAMES = [
  "Ada",
  "Alan",
  "Barbara",
  "Dennis",
  "Edsger",
  "Frances",
  "Grace",
  "Hedy",
  "Katherine",
  "Ken",
  "Linus",
  "Margaret",
  "Radia",
  "Tim",
];

export function identify(
  request: Pick<IncomingMessage, "headers" | "url">,
  auth: AuthConfig,
): Identity | undefined {
  const { headers } = request;
  const id = headerValue(headers[auth.userIdHeader]);
  const email = headerValue(headers[auth.emailHeader]);
  if (id !== undefined && email !== undefined) return { id, email };
  if (!auth.devUser) return undefined;
  const tab =
    headerValue(headers["x-dev-tab"]) ??
    new URL(request.url ?? "/", "http://localhost").searchParams.get("devTab");
  return (tab === null ? undefined : devTabUser(tab)) ?? auth.devUser;
}

/**
 * In development, each browser tab sends a random ID (see src/client/devTab.ts) and gets a user
 * of its own, so one person can try out collaboration. Undefined for an invalid ID.
 */
export function devTabUser(tab: string): Identity | undefined {
  if (!/^[a-z0-9]{1,32}$/.test(tab)) return undefined;
  let hash = 0;
  for (const char of tab) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const name = DEV_NAMES[hash % DEV_NAMES.length] ?? "Dev";
  // The part before the @ is the default name.
  return { id: `dev-tab-${tab}`, email: `${name}@example.com` };
}

/** The login URL for someone who asked for `path`. */
export function loginRedirectUrl(loginUrl: string, path: string): string {
  return loginUrl.replaceAll("{path}", encodeURIComponent(path));
}

function headerValue(value: string | string[] | undefined): string | undefined {
  const trimmed = (Array.isArray(value) ? value[0] : value)?.trim();
  return trimmed === "" ? undefined : trimmed;
}
