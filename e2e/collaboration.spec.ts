import { type Browser, expect, type Page, test } from "@playwright/test";

/** Each context has its own IndexedDB and BroadcastChannel, like a separate browser. */
async function openInNewBrowser(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  return page;
}

const titleField = (page: Page) => page.getByRole("textbox", { name: "Title" });
const noteEditor = (page: Page) => page.getByRole("textbox", { name: "Note" });

/** Creates a note; the title field has focus first. */
async function createNote(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "New note" }).click();
  await expect(titleField(page)).toBeFocused();
  await page.keyboard.type(title);
}

test("notes and edits sync between separate browsers via the server", async ({ browser }) => {
  const alice = await openInNewBrowser(browser);
  const bob = await openInNewBrowser(browser);
  const title = `Note ${crypto.randomUUID()}`;

  await createNote(alice, title);
  await noteEditor(alice).pressSequentially("Hello");

  const bobsListItem = bob.getByRole("button", { name: title });
  await expect(bobsListItem).toBeVisible();
  await bobsListItem.click();
  await expect(titleField(bob)).toHaveValue(title);
  await expect(noteEditor(bob)).toHaveText("Hello");

  await noteEditor(bob).press("End");
  await bob.keyboard.type(" from Bob");
  await expect(noteEditor(alice)).toHaveText("Hello from Bob");
});

test("title edits show up in the sidebar and title field of other browsers", async ({
  browser,
}) => {
  const alice = await openInNewBrowser(browser);
  const bob = await openInNewBrowser(browser);
  const title = `Note ${crypto.randomUUID()}`;

  await createNote(alice, title);
  await bob.getByRole("button", { name: title }).click();

  await titleField(bob).press("End");
  await bob.keyboard.type(" (renamed)");

  await expect(alice.getByRole("button", { name: `${title} (renamed)` })).toBeVisible();
  await expect(titleField(alice)).toHaveValue(`${title} (renamed)`);
});

test("a note without a title is listed as Untitled", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).click();

  await expect(titleField(page)).toHaveAttribute("placeholder", "Untitled");
  await expect(page.getByRole("button", { name: "Untitled" }).first()).toBeVisible();
});

test("notes sync between tabs of the same browser", async ({ page, context }) => {
  await page.goto("/");
  const otherTab = await context.newPage();
  await otherTab.goto("/");
  const title = `Note ${crypto.randomUUID()}`;

  await createNote(page, title);

  await expect(otherTab.getByRole("button", { name: title })).toBeVisible();
});
