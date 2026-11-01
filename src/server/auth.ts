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
  /**
   * Lowercase names of the headers carrying the user's stable ID and email. Unset only in
   * development, when no proxy is configured.
   */
  headers: { userId: string; email: string } | undefined;
  /** Where to send signed-out visitors. `{path}` is replaced with the page they wanted. */
  loginUrl: string | undefined;
  /** Where the client POSTs to log out. */
  logoutUrl: string | undefined;
  /** Used when a request has no identity headers. Only set outside production. */
  devUser: Identity | undefined;
}

export function identify(
  request: Pick<IncomingMessage, "headers">,
  auth: AuthConfig,
): Identity | undefined {
  const { headers } = request;
  if (auth.headers) {
    const id = headerValue(headers[auth.headers.userId]);
    const email = headerValue(headers[auth.headers.email]);
    if (id !== undefined && email !== undefined) return { id, email };
  }
  return auth.devUser;
}

/**
 * The identity header names from AUTH_USER_ID_HEADER and AUTH_EMAIL_HEADER. Production needs both,
 * because they're the only way to sign in; development works without them.
 */
export function identityHeaderNames(
  env: Record<string, string | undefined>,
  isProduction: boolean,
): AuthConfig["headers"] {
  const userId = env["AUTH_USER_ID_HEADER"]?.trim() ?? "";
  const email = env["AUTH_EMAIL_HEADER"]?.trim() ?? "";
  // Node lowercases incoming header names.
  if (userId !== "" && email !== "") {
    return { userId: userId.toLowerCase(), email: email.toLowerCase() };
  }
  if (userId !== "" || email !== "" || isProduction) {
    throw new Error(
      "Set both AUTH_USER_ID_HEADER and AUTH_EMAIL_HEADER to the headers your auth proxy " +
        "sends. See docs/deploy.md.",
    );
  }
  return undefined;
}

/** The login URL for someone who asked for `path`. */
export function loginRedirectUrl(loginUrl: string, path: string): string {
  return loginUrl.replaceAll("{path}", encodeURIComponent(path));
}

function headerValue(value: string | string[] | undefined): string | undefined {
  const trimmed = (Array.isArray(value) ? value[0] : value)?.trim();
  return trimmed === "" ? undefined : trimmed;
}
