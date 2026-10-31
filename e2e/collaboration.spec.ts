import { type Browser, expect, type Page, test } from "@playwright/test";

/** Each context has its own IndexedDB and BroadcastChannel, like a separate browser. */
async function openInNewBrowser(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  return page;
}

async function createNote(page: Page, text: string): Promise<void> {
  await page.getByRole("button", { name: "New note" }).click();
  await page.getByRole("textbox").pressSequentially(text);
}

test("notes and edits sync between separate browsers via the server", async ({ browser }) => {
  const alice = await openInNewBrowser(browser);
  const bob = await openInNewBrowser(browser);
  const title = `Note ${crypto.randomUUID()}`;

  await createNote(alice, title);

  const bobsListItem = bob.getByRole("button", { name: title });
  await expect(bobsListItem).toBeVisible();
  await bobsListItem.click();
  await expect(bob.getByRole("textbox")).toHaveText(title);

  await bob.getByRole("textbox").press("End");
  await bob.keyboard.type(" (edited by Bob)");
  await expect(alice.getByRole("textbox")).toHaveText(`${title} (edited by Bob)`);
});

test("notes sync between tabs of the same browser", async ({ page, context }) => {
  await page.goto("/");
  const otherTab = await context.newPage();
  await otherTab.goto("/");
  const title = `Note ${crypto.randomUUID()}`;

  await createNote(page, title);

  await expect(otherTab.getByRole("button", { name: title })).toBeVisible();
});
