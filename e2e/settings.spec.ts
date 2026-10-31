import { expect, test } from "@playwright/test";

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
