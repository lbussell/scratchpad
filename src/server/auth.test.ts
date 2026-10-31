import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type AuthConfig, identify, loginRedirectUrl } from "./auth.ts";

const production: AuthConfig = {
  userIdHeader: "x-exedev-userid",
  emailHeader: "x-exedev-email",
  loginUrl: undefined,
  logoutUrl: undefined,
  devUser: undefined,
};
const development: AuthConfig = { ...production, devUser: { id: "dev", email: "dev@example.com" } };

describe("identify", () => {
  it("reads the user from the proxy's headers", () => {
    const headers = { "x-exedev-userid": "u1", "x-exedev-email": "ada@example.com" };
    assert.deepEqual(identify(headers, production), { id: "u1", email: "ada@example.com" });
  });

  it("needs both headers", () => {
    assert.equal(identify({ "x-exedev-userid": "u1" }, production), undefined);
    assert.equal(
      identify({ "x-exedev-userid": " ", "x-exedev-email": "a@b" }, production),
      undefined,
    );
  });

  it("falls back to the dev user only when one is configured", () => {
    assert.equal(identify({}, production), undefined);
    assert.deepEqual(identify({}, development), { id: "dev", email: "dev@example.com" });
  });

  it("prefers real headers over the dev user", () => {
    const headers = { "x-exedev-userid": "u1", "x-exedev-email": "ada@example.com" };
    assert.deepEqual(identify(headers, development), { id: "u1", email: "ada@example.com" });
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
