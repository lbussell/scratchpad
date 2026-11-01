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

export const titleField = (page: Page) => page.getByRole("textbox", { name: "Title" });
export const noteEditor = (page: Page) => page.getByRole("textbox", { name: "Note" });

/** Creates a note; the title field has focus first. */
export async function createNote(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "New note" }).click();
  await expect(titleField(page)).toBeFocused();
  await page.keyboard.type(title);
}
