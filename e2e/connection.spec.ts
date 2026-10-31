import { expect, test, type WebSocketRoute } from "@playwright/test";

test("shows offline while the browser has no network", async ({ page, context }) => {
  await page.goto("/");
  const status = page.getByRole("status", { name: "Connection" });
  await expect(status).toHaveText(/^Online/);

  const onlineBadge = page.locator("[data-slot=avatar-badge]");
  const offlineBanner = page.getByRole("alert");
  await expect(onlineBadge).toBeVisible();
  await expect(offlineBanner).toBeHidden();

  await context.setOffline(true);
  await expect(status).toHaveText(/^Offline/);
  await expect(offlineBanner).toContainText("will sync when you reconnect");
  await expect(onlineBadge).toBeHidden();

  await context.setOffline(false);
  await expect(status).toHaveText(/^Online/);
  await expect(offlineBanner).toBeHidden();
  await expect(onlineBadge).toBeVisible();
});

test("shows offline while the sync server is unreachable", async ({ page }) => {
  let serverDown = false;
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket("**/sync", (socket) => {
    if (serverDown) {
      void socket.close();
      return;
    }
    sockets.push(socket);
    socket.connectToServer();
  });

  await page.goto("/");
  const status = page.getByRole("status", { name: "Connection" });
  await expect(status).toHaveText(/^Online/);

  serverDown = true;
  await Promise.all(sockets.map((socket) => socket.close()));
  await expect(status).toHaveText(/^Offline/);

  serverDown = false;
  await expect(status).toHaveText(/^Online/, { timeout: 15_000 });
});

test("loads notes once the sync server becomes reachable", async ({ page }) => {
  let serverDown = true;
  await page.routeWebSocket("**/sync", (socket) => {
    if (serverDown) {
      void socket.close();
      return;
    }
    socket.connectToServer();
  });

  await page.goto("/");
  await expect(page.getByRole("status", { name: "Connection" })).toHaveText(/^Offline/);

  serverDown = false;
  await expect(page.getByRole("button", { name: "New note" })).toBeVisible({ timeout: 15_000 });
});
