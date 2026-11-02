import { expect, type Page } from "@playwright/test";
import { createDocument, openInNewBrowser, test } from "./helpers.ts";

const todo = (page: Page, text: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("checkbox", { name: text }) });
const group = (page: Page, name: string) => page.getByRole("region", { name });
/** The to-do's checkbox, in the group: to-dos are text fields, whose text locators don't see. */
const inGroup = (page: Page, name: string, text: string) =>
  group(page, name).getByRole("checkbox", { name: text });

test("to-dos are grouped, assigned, and done, in sync between browsers", async ({ browser }) => {
  const id = crypto.randomUUID();
  const bobEmail = `bob-${id}@example.com`;
  // Bob has signed in, so he can be assigned to-dos.
  const bob = await openInNewBrowser(browser, bobEmail);
  const alice = await openInNewBrowser(browser);
  const title = `Chores ${id}`;
  await createDocument(alice, "To-do list", title);

  // New starts an empty to-do; Enter starts the next, or, on an empty one, stops.
  await alice.getByRole("button", { name: "New to-do" }).click();
  await alice.keyboard.type("Water plants");
  await alice.keyboard.press("Enter");
  await alice.keyboard.type("Take out trash");
  await alice.keyboard.press("Enter");
  await expect(alice.getByRole("textbox", { name: "To-do" })).toHaveCount(3);
  await alice.keyboard.press("Enter");
  // The empty one wasn't wanted after all.
  await expect(alice.getByRole("textbox", { name: "To-do" })).toHaveCount(2);
  // Everything is due some day, today to begin with.
  await expect(inGroup(alice, "Today", "Water plants")).toBeVisible();

  // Snoozed to a time, which it shows.
  const plants = todo(alice, "Water plants");
  await plants.getByRole("button", { name: "Snooze" }).click();
  await alice.getByRole("button", { name: /^1 hour / }).click();
  await expect(plants.getByText(/^Due (today|tomorrow) at /)).toBeVisible();

  // Due tomorrow, and assigned to Bob.
  const trash = todo(alice, "Take out trash");
  await trash.getByRole("button", { name: "Snooze" }).click();
  await alice.getByRole("button", { name: /^Tomorrow / }).click();
  await expect(inGroup(alice, "Tomorrow", "Take out trash")).toBeVisible();
  await trash.hover();
  await trash.getByRole("button", { name: "Assign" }).click();
  await alice.getByRole("menuitemradio", { name: `bob-${id}` }).click();
  await expect(
    trash.getByRole("button", { name: `Assigned to bob-${id}. Reassign` }),
  ).toBeVisible();

  await bob.getByRole("button", { name: title }).click();
  await expect(inGroup(bob, "Tomorrow", "Take out trash")).toBeVisible();
  await expect(
    todo(bob, "Take out trash").getByRole("button", { name: /^Assigned to/ }),
  ).toBeVisible();

  // Done moves it to the bottom for everyone, and undoing puts it back.
  await todo(bob, "Take out trash").getByRole("checkbox").click();
  await expect(inGroup(alice, "Done today", "Take out trash")).toBeVisible();
  await expect(group(alice, "Tomorrow")).toBeHidden();
  await todo(alice, "Take out trash").getByRole("checkbox").click();
  await expect(inGroup(bob, "Tomorrow", "Take out trash")).toBeVisible();
  await expect(group(bob, "Done today")).toBeHidden();
});
