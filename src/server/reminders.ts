import path from "node:path";
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import type {
  BaseDoc,
  PushPayload,
  RootDoc,
  TimeOfDay,
  Todo,
  TodoListDoc,
} from "../shared/schema.ts";
import { JsonFileWriter, readJsonFile } from "./files.ts";
import type { DeviceSubscription, PushResult, PushSubscriptionStore } from "./push.ts";

/** A to-do, and the list it's in. */
export interface ListedTodo {
  listUrl: AutomergeUrl;
  listTitle: string;
  id: string;
  todo: Todo;
}

/** Whether a user is reminded of a to-do: if it's assigned to them, or to nobody. */
export function isFor(todo: Todo, userId: string): boolean {
  return todo.assignee === undefined || todo.assignee === userId;
}

/**
 * When a to-do's first reminder comes on a device in `timeZone`: on the day it's due, at its
 * time, or without one, at the person's reminder time. Undefined if its day or time is malformed
 * (any client can write anything).
 */
export function reminderAt(
  todo: Todo,
  reminderTime: TimeOfDay,
  timeZone: string,
): number | undefined {
  try {
    return instantOf(dueDay(todo, timeZone), todo.time ?? reminderTime, timeZone);
  } catch {
    return undefined;
  }
}

/**
 * Whether a to-do reminds someone after `from`, up to `to`: when it's due (see reminderAt), then
 * again every morning, at their reminder time, until it's done or moved to a later day.
 */
export function remindsBetween(
  todo: Todo,
  reminderTime: TimeOfDay,
  timeZone: string,
  from: number,
  to: number,
): boolean {
  if (todo.doneAt !== undefined) return false;
  const first = reminderAt(todo, reminderTime, timeZone);
  if (first === undefined) return false;
  if (first > from && first <= to) return true;
  const due = dueDay(todo, timeZone);
  const last = dayAt(to, timeZone);
  // The days the window touches: one or two, since it's never longer than MAX_CATCH_UP_MS.
  for (let day = dayAt(from, timeZone); Temporal.PlainDate.compare(day, last) <= 0;) {
    if (Temporal.PlainDate.compare(day, due) > 0) {
      const at = instantOf(day, reminderTime, timeZone);
      if (at > from && at <= to) return true;
    }
    day = day.add({ days: 1 });
  }
  return false;
}

/** The day a to-do is due. Like the client, counts one without a day as due the day it was added. */
function dueDay(todo: Todo, timeZone: string): Temporal.PlainDate {
  return todo.due === undefined
    ? dayAt(todo.createdAt, timeZone)
    : Temporal.PlainDate.from(todo.due, { overflow: "reject" });
}

function dayAt(epochMilliseconds: number, timeZone: string): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(epochMilliseconds)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
}

/** A time on a day, there. One that doesn't exist (the clocks went forward) comes an hour later. */
function instantOf(day: Temporal.PlainDate, time: TimeOfDay, timeZone: string): number {
  return day
    .toPlainDateTime(Temporal.PlainTime.from(time, { overflow: "reject" }))
    .toZonedDateTime(timeZone).epochMilliseconds;
}

/** For each device, the to-dos for its user that remind them after `from`, up to `to`. */
export function remindersDue(
  todos: readonly ListedTodo[],
  devices: readonly DeviceSubscription[],
  reminderTimeOf: (userId: string) => TimeOfDay | undefined,
  from: number,
  to: number,
): Map<DeviceSubscription, ListedTodo[]> {
  const due = new Map<DeviceSubscription, ListedTodo[]>();
  for (const device of devices) {
    const reminderTime = reminderTimeOf(device.userId);
    if (reminderTime === undefined) continue;
    const reminders = todos.filter(
      ({ todo }) =>
        isFor(todo, device.userId) && remindsBetween(todo, reminderTime, device.timeZone, from, to),
    );
    if (reminders.length > 0) due.set(device, reminders);
  }
  return due;
}

const MAX_LISTED = 4;

/** The notification for some reminders that came at once: the to-do, or how many and which. */
export function reminderPayload(reminders: readonly ListedTodo[]): PushPayload {
  const [first, ...rest] = reminders;
  if (!first) throw new Error("No reminders");
  const url = `/#${first.listUrl}`;
  if (rest.length === 0) {
    return {
      title: textOf(first.todo),
      body: first.listTitle.trim() === "" ? "Untitled to-do list" : first.listTitle,
      url,
      tag: `todo:${first.id}`,
    };
  }
  const listed = reminders.slice(0, MAX_LISTED).map(({ todo }) => textOf(todo));
  const more = reminders.length - listed.length;
  return {
    title: `${reminders.length} to-dos`,
    body: [...listed, ...(more > 0 ? [`and ${more} more`] : [])].join("\n"),
    url,
    tag: "todos",
  };
}

const textOf = (todo: Todo) => (todo.text.trim() === "" ? "Untitled to-do" : todo.text.trim());

/** How long to wait for a document the server doesn't have yet. */
const FIND_TIMEOUT_MS = 5000;

/** Every to-do in every to-do list in the root document. */
export async function todosIn(repo: Repo, rootDocUrl: AutomergeUrl): Promise<ListedTodo[]> {
  const root = (await repo.find<RootDoc>(rootDocUrl)).doc();
  const lists = await Promise.all(
    (root?.documents ?? []).map(async (listUrl) => {
      try {
        const handle = await repo.find<BaseDoc>(listUrl, {
          signal: AbortSignal.timeout(FIND_TIMEOUT_MS),
        });
        return { listUrl, doc: handle.doc() };
      } catch {
        // Not here yet, or gone. Its reminders come once a client has synced it.
        return { listUrl, doc: undefined };
      }
    }),
  );
  return lists.flatMap(({ listUrl, doc }) =>
    isTodoList(doc)
      ? Object.entries(doc.todos)
          // Any client can write anything; skip what this code couldn't have.
          .filter(([, todo]) => typeof todo.text === "string" && typeof todo.createdAt === "number")
          .map(([id, todo]) => ({ listUrl, listTitle: doc.title, id, todo }))
      : [],
  );
}

function isTodoList(doc: BaseDoc | undefined): doc is TodoListDoc {
  return (
    doc?.type === "todo-list" &&
    "todos" in doc &&
    typeof doc.todos === "object" &&
    doc.todos !== null &&
    typeof doc.title === "string"
  );
}

/** How often to look for reminders that have come. They're at most this late. */
const CHECK_INTERVAL_MS = 30_000;
/**
 * After the server has been down, how far back to send reminders it missed. Older ones would be
 * more noise than help, and push services drop messages older than this anyway (see sendPush).
 */
const MAX_CATCH_UP_MS = 12 * 60 * 60 * 1000;

interface ReminderSchedulerOptions {
  dataDir: string;
  listTodos: () => Promise<ListedTodo[]>;
  devices: PushSubscriptionStore;
  reminderTimeOf: (userId: string) => TimeOfDay | undefined;
  send: (device: DeviceSubscription, payload: PushPayload) => Promise<PushResult>;
  now?: () => number;
}

/**
 * Sends reminders as they come. Every so often it sends those that came since it last looked,
 * which it saves, so each reminder is sent once, even across restarts. A to-do moved to a time
 * that's already passed isn't reminded of.
 */
export class ReminderScheduler {
  readonly #options: ReminderSchedulerOptions;
  readonly #file: JsonFileWriter;
  readonly #now: () => number;
  #checkedUntil = 0;
  #timer: ReturnType<typeof setInterval> | undefined;
  #checking: Promise<void> | undefined;

  constructor(options: ReminderSchedulerOptions) {
    this.#options = options;
    this.#file = new JsonFileWriter(stateFile(options.dataDir));
    this.#now = options.now ?? Date.now;
  }

  async start(): Promise<void> {
    const saved = await readJsonFile(stateFile(this.#options.dataDir));
    const checkedUntil =
      typeof saved === "object" &&
      saved !== null &&
      "checkedUntil" in saved &&
      typeof saved.checkedUntil === "number"
        ? saved.checkedUntil
        : // The first run: nothing before now.
          this.#now();
    this.#checkedUntil = Math.max(checkedUntil, this.#now() - MAX_CATCH_UP_MS);
    await this.check();
    this.#timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
  }

  stop(): Promise<void> {
    clearInterval(this.#timer);
    return this.#checking ?? Promise.resolve();
  }

  /** Sends the reminders that have come since the last check. One check runs at a time. */
  check(): Promise<void> {
    this.#checking ??= this.#check().finally(() => {
      this.#checking = undefined;
    });
    return this.#checking;
  }

  async #check(): Promise<void> {
    const { listTodos, devices, reminderTimeOf, send } = this.#options;
    const to = this.#now();
    try {
      const due = remindersDue(
        await listTodos(),
        devices.all(),
        reminderTimeOf,
        this.#checkedUntil,
        to,
      );
      await Promise.all(
        [...due].map(async ([device, reminders]) => {
          const result = await send(device, reminderPayload(reminders));
          console.info(`Reminder of ${reminders.length} to-do(s) for ${device.userId}: ${result}`);
          if (result === "gone") await devices.remove(device.endpoint);
        }),
      );
    } catch (error) {
      // Try again next time, from the same point.
      console.error("Couldn’t check for reminders:", error);
      return;
    }
    this.#checkedUntil = to;
    await this.#file.write({ checkedUntil: to }).catch((error: unknown) => {
      console.error("Couldn’t save when reminders were last checked:", error);
    });
  }
}

const stateFile = (dataDir: string) => path.join(dataDir, "reminders.json");
