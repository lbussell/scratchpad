import type { Person, Todo, TodoListDoc } from "../shared/schema.ts";

/** A calendar day, `YYYY-MM-DD`, in the viewer's time zone. Compares correctly as a string. */
export type Day = string;

export function newTodoList(): TodoListDoc {
  return { type: "todo-list", title: "", todos: {}, createdAt: Date.now() };
}

// Days -------------------------------------------------------------------------------------------

/** The day `date` falls on, here. */
export function dayOf(date: Date): Day {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Midnight at the start of the day, here. */
export function dateOf(day: Day): Date {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function addDays(day: Day, days: number): Day {
  const date = dateOf(day);
  date.setDate(date.getDate() + days);
  return dayOf(date);
}

export function isDay(value: unknown): value is Day {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Grouping ---------------------------------------------------------------------------------------

/** Open to-dos, grouped by when they're due. Overdue ones are due today. */
export const DUE_GROUPS = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "Next 7 days" },
  { id: "month", label: "Next 30 days" },
  { id: "later", label: "Later" },
] as const;
export type DueGroup = (typeof DUE_GROUPS)[number]["id"];

/** Done to-dos, grouped by when they were done. */
export const DONE_GROUPS = [
  { id: "today", label: "Done today" },
  { id: "week", label: "Done in the last 7 days" },
  { id: "earlier", label: "Done earlier" },
] as const;
export type DoneGroup = (typeof DONE_GROUPS)[number]["id"];

/** Which group an open to-do goes in. To-dos without a due date go last. */
export function dueGroup(due: Day | undefined, today: Day): DueGroup {
  if (due === undefined) return "later";
  if (due <= today) return "today";
  if (due === addDays(today, 1)) return "tomorrow";
  if (due <= addDays(today, 7)) return "week";
  if (due <= addDays(today, 30)) return "month";
  return "later";
}

/** Which group a done to-do goes in. The last 7 days include today, but today has its own group. */
export function doneGroup(doneAt: number, today: Day): DoneGroup {
  const day = dayOf(new Date(doneAt));
  if (day >= today) return "today";
  if (day > addDays(today, -7)) return "week";
  return "earlier";
}

export function isOverdue(todo: Todo, today: Day): boolean {
  return todo.doneAt === undefined && todo.due !== undefined && todo.due < today;
}

export interface TodoEntry {
  id: string;
  todo: Todo;
}

export interface TodoGroup<Id extends string> {
  id: Id;
  label: string;
  todos: TodoEntry[];
}

export interface GroupedTodos {
  /** Only groups with to-dos in them. Within each, in the order they were added. */
  open: TodoGroup<DueGroup>[];
  /** Only groups with to-dos in them. Within each, the most recently done first. */
  done: TodoGroup<DoneGroup>[];
}

export function groupTodos(todos: Record<string, Todo>, today: Day): GroupedTodos {
  const entries = Object.entries(todos).map(([id, todo]) => ({ id, todo }));
  const open = entries
    .filter(({ todo }) => todo.doneAt === undefined)
    // Ties, from to-dos added at the same moment on different devices, sort the same everywhere.
    .toSorted((a, b) => a.todo.createdAt - b.todo.createdAt || compare(a.id, b.id));
  const done = entries
    .filter(({ todo }) => todo.doneAt !== undefined)
    .toSorted((a, b) => (b.todo.doneAt ?? 0) - (a.todo.doneAt ?? 0) || compare(a.id, b.id));

  return {
    open: DUE_GROUPS.map(({ id, label }) => ({
      id,
      label,
      todos: open.filter(({ todo }) => dueGroup(todo.due, today) === id),
    })).filter((group) => group.todos.length > 0),
    done: DONE_GROUPS.map(({ id, label }) => ({
      id,
      label,
      todos: done.filter(({ todo }) => doneGroup(todo.doneAt ?? 0, today) === id),
    })).filter((group) => group.todos.length > 0),
  };
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Due dates --------------------------------------------------------------------------------------

/** Quick ways to set or move a due date. */
export const SNOOZES = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "next-week", label: "Next week" },
  { id: "next-weekend", label: "Next weekend" },
] as const;
export type Snooze = (typeof SNOOZES)[number]["id"];

const SATURDAY = 6;
const MONDAY = 1;

/**
 * The day a snooze moves a to-do to. Next week starts on the next Monday and next weekend on the
 * next Saturday, never today.
 */
export function snoozeTo(snooze: Snooze, today: Day): Day {
  return SNOOZE_DAYS[snooze](today);
}

const SNOOZE_DAYS: Record<Snooze, (today: Day) => Day> = {
  today: (today) => today,
  tomorrow: (today) => addDays(today, 1),
  "next-week": (today) => nextWeekday(today, MONDAY),
  "next-weekend": (today) => nextWeekday(today, SATURDAY),
};

function nextWeekday(today: Day, weekday: number): Day {
  const days = (weekday - dateOf(today).getDay() + 7) % 7;
  return addDays(today, days === 0 ? 7 : days);
}

/**
 * A due date as people say it: "Today", "Tomorrow", "Yesterday", a weekday within the next week,
 * otherwise the date, with the year if it isn't this year's.
 */
export function formatDue(due: Day, today: Day, locale?: string): string {
  if (due === today) return "Today";
  if (due === addDays(today, 1)) return "Tomorrow";
  if (due === addDays(today, -1)) return "Yesterday";
  const date = dateOf(due);
  if (due > today && due < addDays(today, 7)) {
    return date.toLocaleDateString(locale, { weekday: "long" });
  }
  const sameYear = due.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "Due today", "Due Friday", "Due Nov 8": what's shown under a to-do. */
export function dueLabel(due: Day, today: Day, locale?: string): string {
  const when = formatDue(due, today, locale);
  return `Due ${RELATIVE_DAYS.has(when) ? when.toLowerCase() : when}`;
}

const RELATIVE_DAYS = new Set(["Today", "Tomorrow", "Yesterday"]);

/** Who a to-do is assigned to, even someone this device hasn't heard of yet (say, offline). */
export function findAssignee(
  assignee: string | undefined,
  people: readonly Person[],
): Person | undefined {
  if (assignee === undefined) return undefined;
  return people.find(({ id }) => id === assignee) ?? { id: assignee, name: "Someone", hue: null };
}

// Changes ----------------------------------------------------------------------------------------
// Call these inside handle.change. Each finds the to-do by ID, and does nothing if someone else
// has deleted it meanwhile.

export function addTodo(doc: TodoListDoc, id: string, text: string, now = Date.now()): void {
  doc.todos[id] = { text, createdAt: now };
}

export function deleteTodo(doc: TodoListDoc, id: string): void {
  delete doc.todos[id];
}

/** Marks a to-do done or open again. Reopened, it goes back to where it was. */
export function setDone(doc: TodoListDoc, id: string, done: boolean, now = Date.now()): void {
  const todo = doc.todos[id];
  if (!todo) return;
  if (done) todo.doneAt = now;
  else delete todo.doneAt;
}

export function setDue(doc: TodoListDoc, id: string, due: Day | null): void {
  const todo = doc.todos[id];
  if (!todo) return;
  if (due === null) delete todo.due;
  else todo.due = due;
}

export function setAssignee(doc: TodoListDoc, id: string, assignee: string | null): void {
  const todo = doc.todos[id];
  if (!todo) return;
  if (assignee === null) delete todo.assignee;
  else todo.assignee = assignee;
}
