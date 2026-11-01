import { expect, type Page } from "@playwright/test";
import {
  createNote,
  noteEditor,
  openInNewProductionBrowser,
  productionUrl,
  test,
  titleField,
} from "./helpers.ts";

/** Whether this browser has saved the Automerge document at `url` (repo.ts names the database). */
async function isStoredOnDevice(page: Page, url: string): Promise<unknown> {
  const documentId = JSON.stringify(url.replace(/^automerge:/, ""));
  return page.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("scratchpad");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const keys = open.result.transaction("documents").objectStore("documents").getAllKeys();
      keys.onerror = () => reject(keys.error);
      keys.onsuccess = () => {
        open.result.close();
        // Its content, not just bookkeeping like "sync-state".
        resolve(keys.result.some(([id, kind]) => id === ${documentId} && kind !== "sync-state"));
      };
    };
  })`);
}

test("opens offline with every note, including ones never opened", async ({ browser }) => {
  // Someone else writes a note.
  const author = await openInNewProductionBrowser(browser);
  await createNote(author, "Written elsewhere");
  await noteEditor(author).click();
  await author.keyboard.type("Readable offline");
  const noteUrl = decodeURIComponent(new URL(author.url()).hash.slice(1));

  // Wait until the server has all of it: someone else can read it.
  const observer = await openInNewProductionBrowser(browser);
  await observer.getByRole("button", { name: "Written elsewhere" }).click();
  await expect(noteEditor(observer)).toHaveText("Readable offline");

  // On a phone, where the sidebar (which loads the notes it lists) starts closed, open the app
  // without opening the note.
  const page = await openInNewProductionBrowser(browser, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.waitForFunction("navigator.serviceWorker.controller !== null");
  await expect.poll(() => isStoredOnDevice(page, noteUrl)).toBe(true);

  await page.context().setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(page.getByRole("status", { name: "Connection" })).toHaveText(/^Offline/);
  await page.getByRole("button", { name: "Written elsewhere" }).click();
  await expect(titleField(page)).toHaveValue("Written elsewhere");
  await expect(noteEditor(page)).toHaveText("Readable offline");
});

test("still sends signed-out visitors to log in once the app is cached", async ({ browser }) => {
  const page = await openInNewProductionBrowser(browser);
  await page.waitForFunction("navigator.serviceWorker.controller !== null");

  await page.context().clearCookies();
  await page.goto(`${productionUrl}/?from=test`);
  await expect(page).toHaveURL(/\/test-login\?redirect=%2F%3Ffrom%3Dtest$/);
});
