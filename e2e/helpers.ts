import { type Browser, expect, type Page } from "@playwright/test";

/** Headers the auth proxy would add for this user (exe.dev's, the server's defaults). */
export function identityHeaders(email: string): Record<string, string> {
  return { "x-exedev-userid": `id-${email}`, "x-exedev-email": email };
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
