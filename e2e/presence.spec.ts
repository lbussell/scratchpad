import { expect, test } from "@playwright/test";
import { createNote, noteEditor, openInNewBrowser, titleField } from "./helpers.ts";

test("shows other people's carets and selections in their color", async ({ browser }) => {
  const alice = await openInNewBrowser(browser);
  const bob = await openInNewBrowser(browser);
  const title = `Note ${crypto.randomUUID()}`;

  await createNote(alice, title);
  await noteEditor(alice).pressSequentially("Hello world");
  await bob.getByRole("button", { name: title }).click();
  await expect(noteEditor(bob)).toHaveText("Hello world");

  // Alice's editor has focus, so Bob sees her caret, in the hue her browser picked.
  const alicesHue: unknown = await alice.evaluate("JSON.parse(localStorage.getItem('user')).hue");
  const alicesCaret = bob.locator(".cm-remote-caret");
  await expect(alicesCaret).toHaveCount(1);
  await expect(alicesCaret).toHaveAttribute("style", `--peer-hue: ${String(alicesHue)};`);
  await expect(bob.locator(".cm-remote-selection")).toHaveCount(0);

  await noteEditor(alice).press("ControlOrMeta+a");
  await expect(bob.locator(".cm-remote-selection")).toHaveText("Hello world");

  // Bob's caret shows up for Alice too.
  await noteEditor(bob).click();
  await expect(alice.locator(".cm-remote-caret")).toHaveCount(1);

  // Leaving the editor hides your caret.
  await titleField(alice).click();
  await expect(alicesCaret).toHaveCount(0);
});
