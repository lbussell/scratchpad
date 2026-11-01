import { expect, type Page } from "@playwright/test";
import { createFolder, createNote, openInNewBrowser, test, titleField } from "./helpers.ts";

// What only a browser shows: dragging, the row menus and their focus, the delete dialog, and that
// changes sync. How moves and deletes change the tree is covered by src/client/tree.test.ts.

const row = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** The documents in an open folder. */
const folderContents = (page: Page, name: string) => page.getByRole("list", { name });

async function openActions(page: Page, name: string): Promise<void> {
  const item = row(page, name).locator("..");
  await item.hover();
  await item.getByRole("button", { name: /actions$/ }).click();
}

/** Drags a row onto the middle of another, dropping only once the app shows it'll land inside. */
async function dragInto(page: Page, name: string, target: string): Promise<void> {
  const from = await row(page, name).boundingBox();
  const to = await row(page, target).boundingBox();
  if (!from || !to) throw new Error("Rows not found");
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 10 });
  await expect(row(page, target).locator("..").locator('[data-position="into"]')).toBeAttached();
  await page.mouse.up();
}

test("documents are dragged into folders, and the move syncs", async ({ browser }) => {
  const alice = await openInNewBrowser(browser);
  const bob = await openInNewBrowser(browser);
  const id = crypto.randomUUID();
  const [folder, note] = [`Folder ${id}`, `Note ${id}`];
  await createNote(alice, note);
  await createFolder(alice, folder);

  await dragInto(alice, note, folder);

  await expect(folderContents(alice, folder).getByRole("button", { name: note })).toBeVisible();
  await expect(folderContents(bob, folder).getByRole("button", { name: note })).toBeVisible();
});

test("row menus rename, move, and delete after asking", async ({ page }) => {
  await page.goto("/");
  const id = crypto.randomUUID();
  const [folder, renamed, note] = [`Folder ${id}`, `Renamed ${id}`, `Note ${id}`];
  await createFolder(page, folder);
  await createNote(page, note);

  // Menus give focus back to their button as they close, which mustn't end editing the name.
  await openActions(page, folder);
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await expect(page.getByRole("textbox", { name: "Folder name" })).toBeFocused();
  await page.keyboard.type(renamed);
  await page.keyboard.press("Enter");
  await expect(row(page, renamed)).toBeVisible();

  await openActions(page, note);
  await page.getByRole("menuitem", { name: "Move to" }).click();
  await page.getByRole("menuitem", { name: renamed }).click();
  await expect(folderContents(page, renamed).getByRole("button", { name: note })).toBeVisible();

  // The note is open, so deleting its folder closes it.
  await expect(titleField(page)).toHaveValue(note);
  await openActions(page, renamed);
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("The 1 document in it will be deleted too");
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(row(page, renamed)).toBeHidden();
  await expect(row(page, note)).toBeHidden();
  await expect(titleField(page)).toBeHidden();
});
