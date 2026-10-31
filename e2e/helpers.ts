import { type Browser, expect, type Page } from "@playwright/test";

/** Each context has its own IndexedDB and BroadcastChannel, like a separate browser. */
export async function openInNewBrowser(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
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
