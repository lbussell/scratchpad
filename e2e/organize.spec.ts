import { expect, type Page } from "@playwright/test";
import { createFolder, createNote, openInNewBrowser, test, titleField } from "./helpers.ts";

const row = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** The folder's contents: the list right after its row. */
const folderContents = (page: Page, name: string) => page.getByRole("list", { name });

async function openActions(page: Page, name: string): Promise<void> {
  const item = row(page, name).locator("..");
  await item.hover();
  await item.getByRole("button", { name: /actions$/ }).click();
}

/** Drags a row and drops it on `target` at `y`, a fraction of its height (the middle by default). */
async function drag(page: Page, name: string, target: string, y = 0.5): Promise<void> {
  const from = await row(page, name).boundingBox();
  const to = await row(page, target).boundingBox();
  if (!from || !to) throw new Error("Rows not found");
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 20, to.y + to.height * y, { steps: 10 });
  await page.mouse.up();
}

/** Whether `first`'s row is above `second`'s in the sidebar. */
async function isAbove(page: Page, first: string, second: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    row(page, first).boundingBox(),
    row(page, second).boundingBox(),
  ]);
  return a !== null && b !== null && a.y < b.y;
}

test("notes move into folders, and the change syncs", async ({ browser }) => {
  const alice = await openInNewBrowser(browser);
  const bob = await openInNewBrowser(browser);
  const id = crypto.randomUUID();
  const folder = `Folder ${id}`;
  const note = `Note ${id}`;

  await createNote(alice, note);
  await createFolder(alice, folder);
  await openActions(alice, note);
  await alice.getByRole("menuitem", { name: "Move to" }).click();
  await alice.getByRole("menuitem", { name: folder }).click();

  await expect(folderContents(alice, folder).getByRole("button", { name: note })).toBeVisible();
  await expect(folderContents(bob, folder).getByRole("button", { name: note })).toBeVisible();

  await openActions(bob, note);
  await bob.getByRole("menuitem", { name: "Move to" }).click();
  await bob.getByRole("menuitem", { name: "Top level" }).click();
  await expect(folderContents(alice, folder).getByText("Empty")).toBeVisible();
});

test("notes are dragged into folders and reordered", async ({ page }) => {
  await page.goto("/");
  const id = crypto.randomUUID();
  const [first, second, folder] = [`First ${id}`, `Second ${id}`, `Folder ${id}`];
  await createNote(page, first);
  await createNote(page, second);
  await createFolder(page, folder);

  // Drop the first note on the folder's name.
  await drag(page, first, folder);
  await expect(folderContents(page, folder).getByRole("button", { name: first })).toBeVisible();

  // Drag the second note into the folder, onto the top half of the first note.
  await drag(page, second, first, 0.1);
  await expect(folderContents(page, folder).getByRole("button", { name: second })).toBeVisible();
  expect(await isAbove(page, second, first)).toBe(true);
});

test("notes move up and down", async ({ page }) => {
  await page.goto("/");
  const id = crypto.randomUUID();
  const [older, newer] = [`Older ${id}`, `Newer ${id}`];
  await createNote(page, older);
  await createNote(page, newer);
  expect(await isAbove(page, newer, older)).toBe(true);

  await openActions(page, older);
  await page.getByRole("menuitem", { name: "Move up" }).click();
  await expect.poll(() => isAbove(page, older, newer)).toBe(true);
});

test("folders are renamed and collapse", async ({ page }) => {
  await page.goto("/");
  const id = crypto.randomUUID();
  const note = `Note ${id}`;
  await createFolder(page, `Folder ${id}`);
  await openActions(page, `Folder ${id}`);
  await page.getByRole("menuitem", { name: "New note" }).click();
  await expect(titleField(page)).toBeFocused();
  await page.keyboard.type(note);

  await openActions(page, `Folder ${id}`);
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await expect(page.getByRole("textbox", { name: "Folder name" })).toBeFocused();
  await page.keyboard.type(`Renamed ${id}`);
  await page.keyboard.press("Enter");

  const folder = row(page, `Renamed ${id}`);
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  await expect(row(page, note)).toBeVisible();
  await folder.click();
  await expect(folder).toHaveAttribute("aria-expanded", "false");
  await expect(row(page, note)).toBeHidden();
});

test("deleting a folder deletes its notes and closes the open one", async ({ browser }) => {
  const alice = await openInNewBrowser(browser);
  const bob = await openInNewBrowser(browser);
  const id = crypto.randomUUID();
  const [folder, note] = [`Folder ${id}`, `Note ${id}`];
  await createNote(alice, note);
  await createFolder(alice, folder);
  await drag(alice, note, folder);
  await expect(folderContents(bob, folder).getByRole("button", { name: note })).toBeVisible();
  await row(alice, note).click();

  await openActions(alice, folder);
  await alice.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = alice.getByRole("alertdialog");
  await expect(dialog).toContainText("The 1 document in it will be deleted too");
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(titleField(alice)).toBeHidden();
  await Promise.all(
    [alice, bob].flatMap((page) => [
      expect(row(page, folder)).toBeHidden(),
      expect(row(page, note)).toBeHidden(),
    ]),
  );
});

test("deleting a note asks first", async ({ page }) => {
  await page.goto("/");
  const note = `Note ${crypto.randomUUID()}`;
  await createNote(page, note);

  await openActions(page, note);
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(row(page, note)).toBeVisible();

  await openActions(page, note);
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(`Delete “${note}”?`);
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(row(page, note)).toBeHidden();
});
