import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type AuthConfig, identify, identityHeaderNames, loginRedirectUrl } from "./auth.ts";

const production: AuthConfig = {
  headers: { userId: "x-user-id", email: "x-user-email" },
  loginUrl: undefined,
  logoutUrl: undefined,
  devUser: undefined,
};
const development: AuthConfig = { ...production, devUser: { id: "dev", email: "dev@example.com" } };

const request = (headers: Record<string, string> = {}) => ({ headers });

describe("identify", () => {
  it("reads the user from the proxy's headers", () => {
    const headers = { "x-user-id": "u1", "x-user-email": "ada@example.com" };
    assert.deepEqual(identify(request(headers), production), {
      id: "u1",
      email: "ada@example.com",
    });
  });

  it("needs both headers", () => {
    assert.equal(identify(request({ "x-user-id": "u1" }), production), undefined);
    assert.equal(
      identify(request({ "x-user-id": " ", "x-user-email": "a@b" }), production),
      undefined,
    );
  });

  it("falls back to the dev user only when one is configured", () => {
    assert.equal(identify(request(), production), undefined);
    assert.deepEqual(identify(request(), development), { id: "dev", email: "dev@example.com" });
  });

  it("prefers real headers over the dev user", () => {
    const headers = { "x-user-id": "u1", "x-user-email": "ada@example.com" };
    assert.deepEqual(identify(request(headers), development), {
      id: "u1",
      email: "ada@example.com",
    });
  });

  it("ignores identity headers when no header names are configured", () => {
    const headers = { "x-user-id": "u1", "x-user-email": "ada@example.com" };
    assert.deepEqual(
      identify(request(headers), { ...development, headers: undefined }),
      development.devUser,
    );
  });
});

describe("identityHeaderNames", () => {
  const env = { AUTH_USER_ID_HEADER: "X-User-ID", AUTH_EMAIL_HEADER: "X-User-Email" };

  it("lowercases the configured names", () => {
    assert.deepEqual(identityHeaderNames(env, true), {
      userId: "x-user-id",
      email: "x-user-email",
    });
  });

  it("requires both names in production", () => {
    assert.throws(() => identityHeaderNames({}, true), /AUTH_USER_ID_HEADER/);
    assert.throws(() => identityHeaderNames({ ...env, AUTH_EMAIL_HEADER: " " }, true));
  });

  it("allows neither name in development, but not just one", () => {
    assert.equal(identityHeaderNames({}, false), undefined);
    assert.throws(() => identityHeaderNames({ AUTH_USER_ID_HEADER: "X-User-ID" }, false));
  });
});

describe("loginRedirectUrl", () => {
  it("fills in the requested path", () => {
    assert.equal(
      loginRedirectUrl("/__exe.dev/login?redirect={path}", "/notes?x=1#y"),
      "/__exe.dev/login?redirect=%2Fnotes%3Fx%3D1%23y",
    );
  });
});
