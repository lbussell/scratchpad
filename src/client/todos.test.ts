import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Todo, TodoListDoc } from "../shared/schema.ts";
import {
  addDays,
  addTodo,
  dayOf,
  doneGroup,
  dueGroup,
  dueLabel,
  dueOf,
  formatDue,
  formatTime,
  groupTodos,
  isOverdue,
  newTodoList,
  setAssignee,
  setDone,
  setDue,
  snoozeTo,
} from "./todos.ts";

// Sunday, 1 November 2026.
const today = "2026-11-01";
/** A time on a day, here. */
const dateAt = (day: string, hour: number, minute = 0) => {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(year, month - 1, date, hour, minute);
};
const at = (day: string, hour: number) => dateAt(day, hour).getTime();

/** Each group's ID and its to-dos' IDs. */
const ids = (groups: { id: string; todos: { id: string }[] }[]) =>
  groups.map((group) => [group.id, group.todos.map((entry) => entry.id)]);

describe("days", () => {
  it("adds days across months and years", () => {
    assert.equal(addDays("2026-11-30", 1), "2026-12-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });

  it("reads the day in local time", () => {
    assert.equal(dayOf(new Date(2026, 10, 1, 23, 59)), "2026-11-01");
  });
});

describe("dueGroup", () => {
  it("puts overdue to-dos with today's", () => {
    assert.equal(dueGroup("2026-10-01", today), "today");
    assert.equal(dueGroup(today, today), "today");
  });

  it("groups by how soon they're due", () => {
    assert.equal(dueGroup("2026-11-02", today), "tomorrow");
    assert.equal(dueGroup("2026-11-03", today), "week");
    assert.equal(dueGroup("2026-11-08", today), "week");
    assert.equal(dueGroup("2026-11-09", today), "month");
    assert.equal(dueGroup("2026-12-01", today), "month");
    assert.equal(dueGroup("2026-12-02", today), "later");
  });
});

describe("doneGroup", () => {
  it("groups by when they were done, today first", () => {
    assert.equal(doneGroup(at(today, 0), today), "today");
    assert.equal(doneGroup(at("2026-10-31", 23), today), "week");
    assert.equal(doneGroup(at("2026-10-26", 0), today), "week");
    assert.equal(doneGroup(at("2026-10-25", 23), today), "earlier");
  });
});

describe("snoozeTo", () => {
  const morning = dateAt(today, 9, 10);

  it("moves to a time later today", () => {
    assert.deepEqual(snoozeTo("15-minutes", morning), { due: today, time: "09:25" });
    assert.deepEqual(snoozeTo("1-hour", morning), { due: today, time: "10:10" });
    assert.deepEqual(snoozeTo("2-hours", morning), { due: today, time: "11:10" });
    assert.deepEqual(snoozeTo("4-hours", morning), { due: today, time: "13:10" });
  });

  it("moves past midnight late in the evening", () => {
    assert.deepEqual(snoozeTo("4-hours", dateAt(today, 22, 30)), {
      due: "2026-11-02",
      time: "02:30",
    });
  });

  it("moves to a day, without a time", () => {
    assert.deepEqual(snoozeTo("today", morning), { due: today });
    assert.deepEqual(snoozeTo("tomorrow", morning), { due: "2026-11-02" });
  });

  it("moves to the next Monday, a week away on a Monday", () => {
    assert.deepEqual(snoozeTo("next-week", morning), { due: "2026-11-02" });
    assert.deepEqual(snoozeTo("next-week", dateAt("2026-11-02", 9)), { due: "2026-11-09" });
    assert.deepEqual(snoozeTo("next-week", dateAt("2026-11-07", 9)), { due: "2026-11-09" });
  });

  it("moves to the next Saturday, a week away on a Saturday", () => {
    assert.deepEqual(snoozeTo("next-weekend", morning), { due: "2026-11-07" });
    assert.deepEqual(snoozeTo("next-weekend", dateAt("2026-11-06", 9)), { due: "2026-11-07" });
    assert.deepEqual(snoozeTo("next-weekend", dateAt("2026-11-07", 9)), { due: "2026-11-14" });
  });
});

describe("formatDue", () => {
  it("says nearby days in words", () => {
    assert.equal(formatDue(today, today, "en-US"), "Today");
    assert.equal(formatDue("2026-11-02", today, "en-US"), "Tomorrow");
    assert.equal(formatDue("2026-10-31", today, "en-US"), "Yesterday");
    assert.equal(formatDue("2026-11-06", today, "en-US"), "Friday");
  });

  it("gives other dates, with the year only if it's another year", () => {
    assert.equal(formatDue("2026-11-08", today, "en-US"), "Nov 8");
    assert.equal(formatDue("2026-10-20", today, "en-US"), "Oct 20");
    assert.equal(formatDue("2027-01-04", today, "en-US"), "Jan 4, 2027");
  });
});

describe("dueLabel", () => {
  it("reads as a phrase", () => {
    assert.equal(dueLabel({ due: today }, today, "en-US"), "Due today");
    assert.equal(dueLabel({ due: "2026-10-31" }, today, "en-US"), "Due yesterday");
    assert.equal(dueLabel({ due: "2026-11-06" }, today, "en-US"), "Due Friday");
    assert.equal(dueLabel({ due: "2026-11-08" }, today, "en-US"), "Due Nov 8");
  });

  it("gives the time, if there is one", () => {
    assert.equal(dueLabel({ due: today, time: "15:05" }, today, "en-US"), "Due today at 3:05 PM");
    assert.equal(
      dueLabel({ due: "2026-11-06", time: "09:00" }, today, "en-US"),
      "Due Friday at 9:00 AM",
    );
  });
});

describe("formatTime", () => {
  it("says the time as the locale does", () => {
    assert.equal(formatTime("00:30", "en-US"), "12:30 AM");
    assert.equal(formatTime("18:45", "en-GB"), "18:45");
  });
});

describe("dueOf", () => {
  it("is the day the to-do was added, if it has no due date", () => {
    assert.equal(dueOf({ text: "", createdAt: at("2026-10-20", 15) }), "2026-10-20");
    assert.equal(dueOf({ text: "", createdAt: 0, due: today }), today);
  });
});

describe("isOverdue", () => {
  it("is overdue only while open and due before today", () => {
    const todo: Todo = { text: "", createdAt: 0, due: "2026-10-31" };
    assert.equal(isOverdue(todo, today), true);
    assert.equal(isOverdue({ ...todo, due: today }, today), false);
    assert.equal(isOverdue({ ...todo, doneAt: 1 }, today), false);
  });

  it("counts a to-do without a due date as due the day it was added", () => {
    assert.equal(isOverdue({ text: "", createdAt: at("2026-10-20", 15) }, today), true);
    assert.equal(isOverdue({ text: "", createdAt: at(today, 15) }, today), false);
  });
});

/** A list of to-dos named by their IDs. */
function list(todos: Record<string, Partial<Todo>>): TodoListDoc {
  const doc = newTodoList();
  for (const [id, todo] of Object.entries(todos)) {
    doc.todos[id] = { text: id, createdAt: 0, due: "2027-01-01", ...todo };
  }
  return doc;
}

describe("groupTodos", () => {
  it("leaves out empty groups, and lists open to-dos in the order they were added", () => {
    const doc = list({
      b: { createdAt: 2 },
      a: { createdAt: 1 },
      overdue: { createdAt: 3, due: "2026-10-01" },
      soon: { createdAt: 0, due: "2026-11-05" },
    });
    assert.deepEqual(ids(groupTodos(doc.todos, today).open), [
      ["today", ["overdue"]],
      ["week", ["soon"]],
      ["later", ["a", "b"]],
    ]);
  });

  it("orders ties the same everywhere", () => {
    const doc = list({ y: {}, x: {} });
    assert.deepEqual(ids(groupTodos(doc.todos, today).open), [["later", ["x", "y"]]]);
  });

  it("lists done to-dos by when they were done, most recent first", () => {
    const doc = list({
      first: { doneAt: at(today, 9) },
      second: { doneAt: at(today, 10) },
      lastWeek: { doneAt: at("2026-10-28", 10) },
      longAgo: { doneAt: at("2026-01-01", 10) },
    });
    const grouped = groupTodos(doc.todos, today);
    assert.deepEqual(grouped.open, []);
    assert.deepEqual(ids(grouped.done), [
      ["today", ["second", "first"]],
      ["week", ["lastWeek"]],
      ["earlier", ["longAgo"]],
    ]);
  });
});

const add = (doc: TodoListDoc, id: string, createdAt: number) =>
  addTodo(doc, id, { text: id.toUpperCase(), due: today }, createdAt);

describe("changes", () => {
  it("adds a to-do due on the day given", () => {
    const doc = newTodoList();
    add(doc, "a", 1);
    assert.deepEqual(doc.todos["a"], { text: "A", createdAt: 1, due: today });
  });

  it("reopens a done to-do where it was", () => {
    const doc = newTodoList();
    add(doc, "a", 1);
    add(doc, "b", 2);
    setDone(doc, "a", true, at(today, 9));
    assert.deepEqual(ids(groupTodos(doc.todos, today).open), [["today", ["b"]]]);
    setDone(doc, "a", false);
    assert.equal("doneAt" in (doc.todos["a"] ?? {}), false);
    assert.deepEqual(ids(groupTodos(doc.todos, today).open), [["today", ["a", "b"]]]);
  });

  it("moves a to-do to a time, or to a day without one", () => {
    const doc = newTodoList();
    add(doc, "a", 1);
    const todo = doc.todos["a"];
    assert.ok(todo);
    setDue(doc, "a", { due: "2026-11-02", time: "09:30" });
    assert.equal(todo.due, "2026-11-02");
    assert.equal(todo.time, "09:30");
    setDue(doc, "a", { due: "2026-11-03" });
    assert.equal(todo.due, "2026-11-03");
    assert.equal("time" in todo, false);
  });

  it("removes an assignee rather than storing nothing", () => {
    const doc = newTodoList();
    add(doc, "a", 1);
    const todo = doc.todos["a"];
    assert.ok(todo);
    setAssignee(doc, "a", "someone");
    assert.equal(todo.assignee, "someone");
    setAssignee(doc, "a", null);
    assert.equal("assignee" in todo, false);
  });

  it("ignores changes to a to-do someone else deleted", () => {
    const doc = newTodoList();
    setDone(doc, "gone", true);
    setDue(doc, "gone", { due: today });
    assert.deepEqual(doc.todos, {});
  });
});
