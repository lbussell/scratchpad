import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createNote,
  identityHeaders,
  noteEditor,
  openInNewBrowser,
  test,
  titleField,
} from "./helpers.ts";

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

test("shows who has each note open, in the sidebar", async ({ browser }) => {
  const aliceName = `alice-${crypto.randomUUID()}`;
  const alice = await openInNewBrowser(browser, `${aliceName}@example.com`);
  const bob = await openInNewBrowser(browser);
  const first = `Note ${crypto.randomUUID()}`;
  const second = `Note ${crypto.randomUUID()}`;
  await createNote(bob, first);
  await createNote(bob, second);

  const noteRow = (title: string) =>
    bob.getByRole("listitem").filter({ has: bob.getByRole("button", { name: title }) });
  await alice.getByRole("button", { name: first }).click();
  await expect(noteRow(first)).toContainText(`${aliceName} is here`);
  await expect(noteRow(second)).not.toContainText(aliceName);

  await alice.getByRole("button", { name: second }).click();
  await expect(noteRow(second)).toContainText(`${aliceName} is here`);
  await expect(noteRow(first)).not.toContainText(aliceName);

  // Settings isn't a note.
  await alice.getByRole("link", { name: "Settings" }).click();
  await expect(noteRow(second)).not.toContainText(aliceName);
});

const people = (page: Page) => page.getByRole("list", { name: "People in this note" });

/** SLEEP_AFTER_MS in src/client/presence.ts. */
const SLEEP_AFTER_MS = 30_000;

test("shows eyes beside the title for everyone else in the note", async ({ browser }) => {
  const aliceName = `alice-${crypto.randomUUID()}`;
  const alice = await openInNewBrowser(browser, `${aliceName}@example.com`);
  const bobName = `bob-${crypto.randomUUID()}`;
  const bobsContext = await browser.newContext({
    extraHTTPHeaders: identityHeaders(`${bobName}@example.com`),
  });
  // Bob's clock is fake, to fast-forward through Alice going idle.
  await bobsContext.clock.install();
  const bob = await bobsContext.newPage();
  await bob.goto("/");
  const title = `Note ${crypto.randomUUID()}`;
  await createNote(alice, title);
  await noteEditor(alice).pressSequentially("Hello world");
  await bob.getByRole("button", { name: title }).click();

  await expect(people(bob).getByRole("listitem")).toHaveText([aliceName]);
  await expect(people(alice).getByRole("listitem")).toHaveText([bobName]);

  // Alice's eyes look towards her mouse: the start of the text is left of and below them.
  await noteEditor(alice).hover({ position: { x: 2, y: 8 } });
  const alicesEyes = bob.locator('[data-slot="peer-eyes"]');
  await expect(alicesEyes).toHaveAttribute("style", /--eyes-x: -\d/);
  await expect(alicesEyes).toHaveAttribute("style", /--eyes-y: \d/);

  await bob.clock.fastForward(SLEEP_AFTER_MS + 1000);
  await expect(people(bob).getByRole("listitem")).toHaveText([`${aliceName} (idle)`]);
  // Doing anything wakes her up.
  await noteEditor(alice).click();
  await expect(people(bob).getByRole("listitem")).toHaveText([aliceName]);

  // Leaving the note takes her eyes with her.
  await alice.getByRole("link", { name: "Settings" }).click();
  await expect(people(bob)).toHaveCount(0);
});

test("can show others by their initials instead of eyes, in settings", async ({ browser }) => {
  const alice = await openInNewBrowser(browser, `ada-${crypto.randomUUID()}@example.com`);
  const bob = await openInNewBrowser(browser);
  const title = `Note ${crypto.randomUUID()}`;
  await createNote(alice, title);
  await bob.getByRole("button", { name: title }).click();
  const alicesCharacter = people(bob).locator('[data-slot="peer-eyes"]');
  await expect(alicesCharacter).toHaveAttribute("data-face", "eyes");

  await bob.getByRole("link", { name: "Settings" }).click();
  const setting = bob.getByRole("combobox", { name: "Show others as" });
  await expect(setting).toHaveText("Eyes");
  await setting.click();
  await bob.getByRole("option", { name: "Initials" }).click();
  await expect(setting).toHaveText("Initials");

  await bob.goBack();
  await expect(alicesCharacter).toHaveAttribute("data-face", "initials");
  await expect(alicesCharacter.locator("[data-initials]")).toHaveAttribute("data-initials", "A");

  // It's saved with Bob's profile.
  await bob.reload();
  await expect(alicesCharacter).toHaveAttribute("data-face", "initials");
});
