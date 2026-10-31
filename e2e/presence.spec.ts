import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createNote, noteEditor, openInNewBrowser, titleField } from "./helpers.ts";

/** The cursor hue the server assigned to this page's user. */
async function hueOf(page: Page): Promise<unknown> {
  return page.evaluate(
    "fetch('/api/session').then((response) => response.json()).then((session) => session.user.hue)",
  );
}

test("shows other people's carets and selections in their color", async ({ browser }) => {
  const alice = await openInNewBrowser(browser);
  const bob = await openInNewBrowser(browser);
  const title = `Note ${crypto.randomUUID()}`;

  await createNote(alice, title);
  await noteEditor(alice).pressSequentially("Hello world");
  await bob.getByRole("button", { name: title }).click();
  await expect(noteEditor(bob)).toHaveText("Hello world");

  // Alice's editor has focus, so Bob sees her caret, in her user's hue.
  const alicesHue = await hueOf(alice);
  expect(alicesHue).not.toBe(await hueOf(bob));
  const alicesCaret = bob.locator(".cm-remote-caret");
  await expect(alicesCaret).toHaveCount(1);
  await expect(alicesCaret).toHaveAttribute(
    "style",
    `--peer-hue: ${String(alicesHue)}; --peer-tint: 1;`,
  );
  await expect(bob.locator(".cm-remote-selection")).toHaveCount(0);

  await noteEditor(alice).press("ControlOrMeta+a");
  await expect(bob.locator(".cm-remote-selection")).toHaveText("Hello world");

  // Bob's caret shows up for Alice too.
  await noteEditor(bob).click();
  await expect(alice.locator(".cm-remote-caret")).toHaveCount(1);

  // Picking a new color recolors your caret for everyone, live. Neutral is gray.
  const bobsCaret = alice.locator(".cm-remote-caret");
  await bob.getByRole("link", { name: "Settings" }).click();
  await bob.getByRole("radio", { name: "Neutral" }).click();
  await expect(bob.getByRole("radio", { name: "Neutral" })).toBeChecked();
  await bob.goBack();
  await noteEditor(bob).click();
  await expect(bobsCaret).toHaveAttribute("style", /--peer-tint: 0;/);

  // Leaving the editor hides your caret.
  await titleField(alice).click();
  await expect(alicesCaret).toHaveCount(0);
});
