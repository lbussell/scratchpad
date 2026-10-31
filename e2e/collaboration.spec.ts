import { expect, test } from "@playwright/test";
import { createNote, noteEditor, openInNewBrowser, titleField } from "./helpers.ts";

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

test("the caret stays put when someone else edits the title", async ({ browser }) => {
  const alice = await openInNewBrowser(browser);
  const bob = await openInNewBrowser(browser);
  const title = crypto.randomUUID();

  await createNote(alice, title);
  await bob.getByRole("button", { name: title }).click();
  await expect(titleField(bob)).toHaveValue(title);

  // Alice's caret sits after the 4th character while Bob types at the start.
  await titleField(alice).press("Home");
  await alice.keyboard.press("ArrowRight");
  await alice.keyboard.press("ArrowRight");
  await alice.keyboard.press("ArrowRight");
  await alice.keyboard.press("ArrowRight");
  await titleField(bob).press("Home");
  await bob.keyboard.type("Re: ");
  await expect(titleField(alice)).toHaveValue(`Re: ${title}`);

  await alice.keyboard.type("!");
  const expected = `Re: ${title.slice(0, 4)}!${title.slice(4)}`;
  await expect(titleField(alice)).toHaveValue(expected);
  await expect(titleField(bob)).toHaveValue(expected);
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
