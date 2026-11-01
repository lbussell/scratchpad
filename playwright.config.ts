import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3300;
// A production build, for what development leaves out, like the service worker.
const productionPort = 3301;
const productionServerPort = 3302;
process.env["E2E_PRODUCTION_URL"] ??= `http://localhost:${productionPort}`;

// Each run gets fresh sync-server data dirs. Workers inherit them through the environment.
process.env["E2E_DATA_DIR"] ??= mkdtempSync(path.join(tmpdir(), "scratchpad-e2e-"));
process.env["E2E_PRODUCTION_DATA_DIR"] ??= mkdtempSync(path.join(tmpdir(), "scratchpad-e2e-prod-"));

export default defineConfig({
  testDir: "e2e",
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev",
      url: `http://localhost:${port}`,
      env: {
        PORT: String(port),
        DATA_DIR: process.env["E2E_DATA_DIR"],
        // What e2e/helpers.ts sends to act as a user.
        AUTH_USER_ID_HEADER: "X-User-ID",
        AUTH_EMAIL_HEADER: "X-User-Email",
        // Nothing serves it; e2e/settings.spec.ts intercepts the request.
        AUTH_LOGOUT_URL: "/test-logout",
      },
      reuseExistingServer: false,
    },
    {
      // Behind a stand-in for the real auth proxy, which signs people in with a cookie.
      command: `npm run build && (npm start & node e2e/auth-proxy.ts ${productionPort} ${productionServerPort})`,
      url: process.env["E2E_PRODUCTION_URL"],
      timeout: 180_000,
      env: {
        PORT: String(productionServerPort),
        HOST: "127.0.0.1",
        // On the development server, which serves the app for any path rather than redirecting.
        AUTH_LOGIN_URL: `http://localhost:${port}/test-login?redirect={path}`,
        DATA_DIR: process.env["E2E_PRODUCTION_DATA_DIR"],
        AUTH_USER_ID_HEADER: "X-User-ID",
        AUTH_EMAIL_HEADER: "X-User-Email",
      },
      // Without a signed-in user it answers 401, which Playwright counts as up.
      reuseExistingServer: false,
    },
  ],
});
