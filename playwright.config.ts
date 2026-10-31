import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3300;

// Each run gets a fresh sync-server data dir. Workers inherit it through the environment.
process.env["E2E_DATA_DIR"] ??= mkdtempSync(path.join(tmpdir(), "scratchpad-e2e-"));

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
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${port}`,
    env: { PORT: String(port), DATA_DIR: process.env["E2E_DATA_DIR"] },
    reuseExistingServer: false,
  },
});
