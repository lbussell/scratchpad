import { expect, test } from "@playwright/test";

test("the theme can be changed in settings and is remembered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/#settings$/);
  await expect(page.getByRole("radio", { name: "System" })).toBeChecked();

  await page.getByText("Dark", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
});
