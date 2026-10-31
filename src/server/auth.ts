import type { IncomingHttpHeaders } from "node:http";

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
  /** Used when a request has no identity headers. Only set outside production. */
  devUser: Identity | undefined;
}

export function identify(headers: IncomingHttpHeaders, auth: AuthConfig): Identity | undefined {
  const id = headerValue(headers[auth.userIdHeader]);
  const email = headerValue(headers[auth.emailHeader]);
  if (id !== undefined && email !== undefined) return { id, email };
  return auth.devUser;
}

/** The login URL for someone who asked for `path`. */
export function loginRedirectUrl(loginUrl: string, path: string): string {
  return loginUrl.replaceAll("{path}", encodeURIComponent(path));
}

function headerValue(value: string | string[] | undefined): string | undefined {
  const trimmed = (Array.isArray(value) ? value[0] : value)?.trim();
  return trimmed === "" ? undefined : trimmed;
}
