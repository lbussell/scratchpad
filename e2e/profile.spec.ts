import { expect, test } from "@playwright/test";
import { openInNewBrowser } from "./helpers.ts";

test("new users are named after their email and can rename themselves", async ({ browser }) => {
  const id = crypto.randomUUID().slice(0, 8);
  const page = await openInNewBrowser(browser, `grace.${id}@example.com`);
  const sidebar = page.locator("[data-slot=sidebar-footer]");
  await expect(sidebar).toContainText(`grace.${id}`);

  await page.getByRole("link", { name: "Settings" }).click();
  const name = page.getByRole("textbox", { name: "Name" });
  const save = page.getByRole("button", { name: "Save" });
  const cancel = page.getByRole("button", { name: "Cancel" });
  await expect(name).toHaveValue(`grace.${id}`);
  await expect(save).toBeDisabled();

  await name.fill("   ");
  await expect(page.getByText("Enter a name.")).toBeVisible();
  await expect(save).toBeDisabled();

  await name.fill("Grace Hopper");
  await cancel.click();
  await expect(name).toHaveValue(`grace.${id}`);

  await name.fill("Grace Hopper");
  await save.click();
  await expect(sidebar).toContainText("Grace Hopper");
  await expect(sidebar).toContainText("GH");
  await expect(save).toBeDisabled();

  await page.reload();
  await expect(name).toHaveValue("Grace Hopper");
});

test("renaming yourself doesn't rename anyone else", async ({ browser }) => {
  const id = crypto.randomUUID().slice(0, 8);
  const alice = await openInNewBrowser(browser, `alice.${id}@example.com`);
  const bob = await openInNewBrowser(browser, `bob.${id}@example.com`);

  await alice.getByRole("link", { name: "Settings" }).click();
  await alice.getByRole("textbox", { name: "Name" }).fill("Alice Liddell");
  await alice.getByRole("button", { name: "Save" }).click();
  await expect(alice.locator("[data-slot=sidebar-footer]")).toContainText("Alice Liddell");

  await bob.reload();
  await expect(bob.locator("[data-slot=sidebar-footer]")).toContainText(`bob.${id}`);
});
