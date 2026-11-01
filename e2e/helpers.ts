import { test as base, type Browser, expect, type Page } from "@playwright/test";

/**
 * Closes the contexts each test opens on the shared `browser`. Playwright closes only its own
 * `context`; the rest would stay open, still syncing, until the worker ends, slowing every later
 * test (badly on a two-core machine, where there's a single worker).
 */
export const test = base.extend<{ closeOpenedContexts: void }>({
  closeOpenedContexts: [
    async ({ browser }, use) => {
      const before = new Set(browser.contexts());
      await use();
      await Promise.all(
        browser
          .contexts()
          .filter((context) => !before.has(context))
          .map((context) => context.close()),
      );
    },
    { auto: true },
  ],
});

/** Headers the auth proxy would add for this user (the names playwright.config.ts sets). */
export function identityHeaders(email: string): Record<string, string> {
  return { "x-user-id": `id-${email}`, "x-user-email": email };
}

/**
 * Each context has its own IndexedDB and BroadcastChannel, like a separate browser, and is signed
 * in as its own user unless one is given.
 */
export async function openInNewBrowser(
  browser: Browser,
  email = `${crypto.randomUUID()}@example.com`,
): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: identityHeaders(email) });
  const page = await context.newPage();
  await page.goto("/");
  return page;
}

// A production build behind e2e/auth-proxy.ts, for what development leaves out, like the
// service worker (playwright.config.ts starts it).
export const productionUrl = process.env["E2E_PRODUCTION_URL"] ?? "";

/**
 * Like openInNewBrowser, but on the production build, signed in with a cookie as behind the real
 * auth proxy.
 */
export async function openInNewProductionBrowser(
  browser: Browser,
  options: Parameters<Browser["newContext"]>[0] = {},
): Promise<Page> {
  const context = await browser.newContext(options);
  await context.addCookies([
    { name: "e2e-user", value: `${crypto.randomUUID()}@example.com`, url: productionUrl },
  ]);
  const page = await context.newPage();
  await page.goto(productionUrl);
  return page;
}

export const titleField = (page: Page) => page.getByRole("textbox", { name: "Title" });
export const noteEditor = (page: Page) => page.getByRole("textbox", { name: "Note" });

export const newButton = (page: Page) => page.getByRole("button", { name: "New", exact: true });

/** Creates a note at the top of the sidebar; the title field has focus first. */
export async function createNote(page: Page, title: string): Promise<void> {
  await createDocument(page, "Note", title);
}

/** Creates a document of the type the New menu calls `type`, and types its title. */
export async function createDocument(page: Page, type: string, title: string): Promise<void> {
  await newButton(page).click();
  await page.getByRole("menuitem", { name: type }).click();
  await expect(titleField(page)).toBeFocused();
  await page.keyboard.type(title);
}

/** Creates a folder at the top of the sidebar and names it. */
export async function createFolder(page: Page, name: string): Promise<void> {
  await newButton(page).click();
  await page.getByRole("menuitem", { name: "Folder" }).click();
  await expect(page.getByRole("textbox", { name: "Folder name" })).toBeFocused();
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
}
