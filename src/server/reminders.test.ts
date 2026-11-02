import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { generateAutomergeUrl } from "@automerge/automerge-repo";
import type { PushPayload, Todo } from "../shared/schema.ts";
import { type DeviceSubscription, PushSubscriptionStore } from "./push.ts";
import {
  type ListedTodo,
  reminderAt,
  remindsBetween,
  ReminderScheduler,
  reminderPayload,
  remindersDue,
} from "./reminders.ts";

const tempDir = () => mkdtemp(path.join(tmpdir(), "scratchpad-reminders-"));
const listUrl = generateAutomergeUrl();
const ny = "America/New_York";
/** Epoch milliseconds for a time with an offset, like "2026-11-02T06:00-05:00". */
const at = (iso: string) => Date.parse(iso);

const todo = (fields: Partial<Todo> = {}): Todo => ({
  text: "Water plants",
  createdAt: 0,
  due: "2026-11-02",
  ...fields,
});
const listed = (id: string, fields: Partial<Todo> = {}): ListedTodo => ({
  listUrl,
  listTitle: "Chores",
  id,
  todo: todo(fields),
});
const device = (userId: string, timeZone = ny): DeviceSubscription => ({
  endpoint: `https://push.example/${userId}/${timeZone}`,
  keys: { p256dh: "p256dh", auth: "auth" },
  userId,
  timeZone,
});

describe("reminderAt", () => {
  it("comes at the person's reminder time on the day it's due, in the device's time zone", () => {
    assert.equal(reminderAt(todo(), "06:00", ny), at("2026-11-02T06:00-05:00"));
    assert.equal(reminderAt(todo(), "06:00", "Europe/Paris"), at("2026-11-02T06:00+01:00"));
  });

  it("comes at the to-do's own time, if it has one", () => {
    assert.equal(reminderAt(todo({ time: "15:30" }), "06:00", ny), at("2026-11-02T15:30-05:00"));
  });

  it("keeps to the clock across daylight saving time", () => {
    // New York's clocks went back on 1 November 2026 and go forward on 14 March 2027.
    assert.equal(
      reminderAt(todo({ due: "2026-10-31" }), "06:00", ny),
      at("2026-10-31T06:00-04:00"),
    );
    assert.equal(
      reminderAt(todo({ due: "2027-03-14" }), "06:00", ny),
      at("2027-03-14T06:00-04:00"),
    );
    // 2:30 doesn't exist that morning.
    assert.equal(
      reminderAt(todo({ due: "2027-03-14", time: "02:30" }), "06:00", ny),
      at("2027-03-14T03:30-04:00"),
    );
  });

  it("counts a to-do without a day as due the day it was added, there", () => {
    const { due: _due, ...undated } = todo({ createdAt: at("2026-10-20T23:30-04:00") });
    assert.equal(reminderAt(undated, "06:00", ny), at("2026-10-20T06:00-04:00"));
    assert.equal(reminderAt(undated, "06:00", "Europe/Paris"), at("2026-10-21T06:00+02:00"));
  });

  it("gives up on a malformed day or time", () => {
    assert.equal(reminderAt(todo({ due: "Friday" }), "06:00", ny), undefined);
    assert.equal(reminderAt(todo({ due: "2026-02-30" }), "06:00", ny), undefined);
    assert.equal(reminderAt(todo({ time: "25:00" }), "06:00", ny), undefined);
  });
});

describe("remindersDue", () => {
  const sixAm = at("2026-11-02T06:00-05:00");
  const reminderTimes: Record<string, string> = { ada: "06:00", bob: "07:00" };
  const reminderTimeOf = (userId: string) => reminderTimes[userId];
  const due = (todos: ListedTodo[], devices: DeviceSubscription[], from: number, to: number) =>
    [...remindersDue(todos, devices, reminderTimeOf, from, to)].map(([{ endpoint }, found]) => [
      endpoint,
      found.map(({ id }) => id),
    ]);

  it("finds reminders that came after the last check, up to now", () => {
    const todos = [listed("a"), listed("b", { time: "06:01" })];
    const ada = device("ada");
    assert.deepEqual(due(todos, [ada], sixAm - 30_000, sixAm), [[ada.endpoint, ["a"]]]);
    assert.deepEqual(due(todos, [ada], sixAm, sixAm + 30_000), []);
    assert.deepEqual(due(todos, [ada], sixAm, sixAm + 60_000), [[ada.endpoint, ["b"]]]);
  });

  it("reminds whoever it's assigned to, or everyone if nobody, at their own time", () => {
    const todos = [listed("anyone's"), listed("bob's", { assignee: "bob" })];
    const ada = device("ada");
    const bob = device("bob");
    const hour = 60 * 60 * 1000;
    assert.deepEqual(due(todos, [ada, bob], sixAm - 1, sixAm), [[ada.endpoint, ["anyone's"]]]);
    assert.deepEqual(due(todos, [ada, bob], sixAm, sixAm + hour), [
      [bob.endpoint, ["anyone's", "bob's"]],
    ]);
  });

  it("reminds each device in its own time zone", () => {
    const newYork = device("ada");
    const paris = device("ada", "Europe/Paris");
    assert.deepEqual(due([listed("a")], [newYork, paris], sixAm - 1, sixAm), [
      [newYork.endpoint, ["a"]],
    ]);
    assert.deepEqual(
      due([listed("a")], [paris], at("2026-11-02T05:59+01:00"), at("2026-11-02T06:00+01:00")),
      [[paris.endpoint, ["a"]]],
    );
  });

  it("leaves out done to-dos and unknown users", () => {
    assert.deepEqual(due([listed("done", { doneAt: 1 })], [device("ada")], sixAm - 1, sixAm), []);
    assert.deepEqual(due([listed("a")], [device("eve")], 0, sixAm), []);
  });
});

const sixAmOn = (day: string) => at(`${day}T06:00-05:00`);
const reminds = (fields: Partial<Todo>, from: number, to: number) =>
  remindsBetween(todo(fields), "06:00", ny, from, to);

describe("remindsBetween", () => {
  it("reminds again every morning while it's overdue", () => {
    const evening = { due: "2026-11-02", time: "20:00" };
    assert.equal(
      reminds(evening, at("2026-11-02T19:59-05:00"), at("2026-11-02T20:00-05:00")),
      true,
    );
    assert.equal(reminds(evening, sixAmOn("2026-11-03") - 1, sixAmOn("2026-11-03")), true);
    assert.equal(reminds(evening, sixAmOn("2026-11-03"), sixAmOn("2026-11-03") + 1000), false);
    assert.equal(reminds(evening, sixAmOn("2026-11-10") - 1, sixAmOn("2026-11-10")), true);
  });

  it("reminds once on the day it's due, and not before", () => {
    assert.equal(reminds({}, sixAmOn("2026-11-02") - 1, sixAmOn("2026-11-02")), true);
    assert.equal(
      reminds({ time: "09:00" }, sixAmOn("2026-11-02") - 1, sixAmOn("2026-11-02")),
      false,
    );
    assert.equal(reminds({}, sixAmOn("2026-11-01") - 1, sixAmOn("2026-11-01")), false);
  });

  it("finds a morning in a window that crosses midnight", () => {
    assert.equal(
      reminds({ due: "2026-11-01" }, at("2026-11-02T00:00-05:00") - 1000, sixAmOn("2026-11-02")),
      true,
    );
  });

  it("stops once it's done", () => {
    assert.equal(reminds({ doneAt: 1 }, sixAmOn("2026-11-03") - 1, sixAmOn("2026-11-03")), false);
  });
});

describe("reminderPayload", () => {
  it("names the to-do and its list, and opens the list", () => {
    assert.deepEqual(reminderPayload([listed("a")]), {
      title: "Water plants",
      body: "Chores",
      url: `/#${listUrl}`,
      tag: "todo:a",
    });
  });

  it("says how many came at once, and lists the first few", () => {
    const todos = ["One", "Two", "Three", "Four", "Five", "Six"].map((text, index) =>
      listed(String(index), { text }),
    );
    assert.deepEqual(reminderPayload(todos.slice(0, 2)), {
      title: "2 to-dos",
      body: "One\nTwo",
      url: `/#${listUrl}`,
      tag: "todos",
    });
    assert.equal(reminderPayload(todos).body, "One\nTwo\nThree\nFour\nand 2 more");
  });

  it("names untitled to-dos and lists", () => {
    const payload = reminderPayload([{ ...listed("a", { text: " " }), listTitle: "" }]);
    assert.equal(payload.title, "Untitled to-do");
    assert.equal(payload.body, "Untitled to-do list");
  });
});

/** A scheduler for Ada's device, with two to-dos: one at her reminder time, one at 9:00. */
async function setUp(dataDir: string, start: number) {
  const devices = await PushSubscriptionStore.open(dataDir);
  await devices.save(device("ada"));
  let now = start;
  const sent: [string, PushPayload][] = [];
  let result: "sent" | "gone" = "sent";
  const scheduler = new ReminderScheduler({
    dataDir,
    listTodos: () => Promise.resolve([listed("a"), listed("b", { time: "09:00" })]),
    devices,
    reminderTimeOf: () => "06:00",
    send: (to, payload) => {
      sent.push([to.userId, payload]);
      return Promise.resolve(result);
    },
    now: () => now,
  });
  return {
    scheduler,
    devices,
    sent,
    setNow: (time: number) => (now = time),
    pushServiceSaysGone: () => (result = "gone"),
  };
}

describe("ReminderScheduler", () => {
  const sixAm = at("2026-11-02T06:00-05:00");

  it("sends each reminder once as it comes, and nothing from before the first run", async () => {
    const dir = await tempDir();
    const { scheduler, sent, setNow } = await setUp(dir, sixAm + 1);
    await scheduler.start();
    await scheduler.stop();
    assert.equal(sent.length, 0);

    setNow(at("2026-11-02T09:00-05:00"));
    await scheduler.check();
    await scheduler.check();
    assert.deepEqual(
      sent.map(([userId, { tag }]) => [userId, tag]),
      [["ada", "todo:b"]],
    );
  });

  it("catches up on what came while it was stopped", async () => {
    const dir = await tempDir();
    const first = await setUp(dir, sixAm - 60_000);
    await first.scheduler.start();
    await first.scheduler.stop();

    const second = await setUp(dir, at("2026-11-02T10:00-05:00"));
    await second.scheduler.start();
    await second.scheduler.stop();
    assert.deepEqual(
      second.sent.map(([, { title }]) => title),
      ["2 to-dos"],
    );
  });

  it("only catches up on the last 12 hours", async () => {
    const dir = await tempDir();
    const first = await setUp(dir, sixAm - 60_000);
    await first.scheduler.start();
    await first.scheduler.stop();

    const second = await setUp(dir, at("2026-11-02T19:30-05:00"));
    await second.scheduler.start();
    await second.scheduler.stop();
    assert.deepEqual(
      second.sent.map(([, { tag }]) => tag),
      ["todo:b"],
    );
  });

  it("forgets a device that's gone", async () => {
    const dir = await tempDir();
    const { scheduler, devices, setNow, pushServiceSaysGone } = await setUp(dir, sixAm - 1);
    await scheduler.start();
    await scheduler.stop();
    pushServiceSaysGone();
    setNow(sixAm);
    await scheduler.check();
    assert.deepEqual(devices.all(), []);
    assert.deepEqual((await PushSubscriptionStore.open(dir)).all(), []);
  });
});

describe("PushSubscriptionStore", () => {
  it("keeps devices by endpoint, so a device moves to whoever subscribed it last", async () => {
    const dir = await tempDir();
    const store = await PushSubscriptionStore.open(dir);
    const shared = device("ada");
    await store.save(shared);
    await store.save({ ...shared, userId: "bob" });
    assert.deepEqual(
      (await PushSubscriptionStore.open(dir)).all().map(({ userId }) => userId),
      ["bob"],
    );
  });

  it("only removes someone's own device, when asked for theirs", async () => {
    const store = await PushSubscriptionStore.open(await tempDir());
    await store.save(device("ada"));
    await store.remove(device("ada").endpoint, "bob");
    assert.equal(store.all().length, 1);
    await store.remove(device("ada").endpoint, "ada");
    assert.equal(store.all().length, 0);
  });
});
