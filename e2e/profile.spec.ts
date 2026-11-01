import { expect, type Page } from "@playwright/test";
import { openInNewBrowser, test } from "./helpers.ts";

const sidebarFooter = (page: Page) => page.locator("[data-slot=sidebar-footer]");

async function rename(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Edit display name" }).click();
  await page.getByRole("textbox", { name: "Display name" }).fill(name);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("textbox", { name: "Display name" })).toBeHidden();
}

test("new users are named after their email and can rename themselves", async ({ browser }) => {
  const id = crypto.randomUUID().slice(0, 8);
  const page = await openInNewBrowser(browser, `grace.${id}@example.com`);
  await expect(sidebarFooter(page)).toContainText(`grace.${id}`);

  await page.getByRole("link", { name: "Settings" }).click();
  const main = page.getByRole("main");
  await expect(main).toContainText(`grace.${id}`);
  const nameField = page.getByRole("textbox", { name: "Display name" });
  await expect(nameField).toBeHidden();

  // Editing starts with the current name, ready to type over.
  await page.getByRole("button", { name: "Edit display name" }).click();
  await expect(nameField).toBeFocused();
  await expect(nameField).toHaveValue(`grace.${id}`);

  await nameField.fill("   ");
  await expect(page.getByText("Enter a name.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();

  // Cancel and Escape both discard the edit.
  await nameField.fill("Grace Hopper");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(nameField).toBeHidden();
  await page.getByRole("button", { name: "Edit display name" }).click();
  await nameField.fill("Grace Hopper");
  await nameField.press("Escape");
  await expect(nameField).toBeHidden();
  await expect(sidebarFooter(page)).toContainText(`grace.${id}`);

  await rename(page, "Grace Hopper");
  await expect(main).toContainText("Grace Hopper");
  await expect(sidebarFooter(page)).toContainText("Grace Hopper");
  await expect(sidebarFooter(page)).toContainText("GH");

  await page.reload();
  await expect(main).toContainText("Grace Hopper");
});

test("renaming yourself doesn't rename anyone else", async ({ browser }) => {
  const id = crypto.randomUUID().slice(0, 8);
  const alice = await openInNewBrowser(browser, `alice.${id}@example.com`);
  const bob = await openInNewBrowser(browser, `bob.${id}@example.com`);

  await alice.getByRole("link", { name: "Settings" }).click();
  await rename(alice, "Alice Liddell");
  await expect(sidebarFooter(alice)).toContainText("Alice Liddell");

  await bob.reload();
  await expect(sidebarFooter(bob)).toContainText(`bob.${id}`);
});
