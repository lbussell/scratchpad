import { expect } from "@playwright/test";
import { openInNewBrowser, test } from "./helpers.ts";

test("the theme can be changed in settings and is remembered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/#settings$/);
  const theme = page.getByRole("combobox", { name: "Theme" });
  await expect(theme).toHaveText("System");

  await theme.click();
  await page.getByRole("option", { name: "Dark" }).click();
  await expect(theme).toHaveText("Dark");
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await expect(theme).toHaveText("Dark");
});

test("your color tints the app and is remembered", async ({ browser }) => {
  const page = await openInNewBrowser(browser);
  await page.getByRole("link", { name: "Settings" }).click();
  const html = page.locator("html");

  await page.getByRole("radio", { name: "Teal" }).click();
  await expect(page.getByRole("radio", { name: "Teal" })).toBeChecked();
  await expect(html).toHaveAttribute("style", /--hue: 180/);

  await page.reload();
  await expect(page.getByRole("radio", { name: "Teal" })).toBeChecked();
  await expect(html).toHaveAttribute("style", /--hue: 180/);
});

test("the Neutral color takes the tint out of the app", async ({ browser }) => {
  const page = await openInNewBrowser(browser);
  await page.getByRole("link", { name: "Settings" }).click();
  const html = page.locator("html");

  await page.getByRole("radio", { name: "Neutral" }).click();
  await expect(page.getByRole("radio", { name: "Neutral" })).toBeChecked();
  await expect(html).toHaveAttribute("style", /--tint: 0/);

  await page.reload();
  await expect(page.getByRole("radio", { name: "Neutral" })).toBeChecked();
  await expect(html).toHaveAttribute("style", /--tint: 0/);

  await page.getByRole("radio", { name: "Teal" }).click();
  await expect(html).toHaveAttribute("style", /--tint: 1/);
});
