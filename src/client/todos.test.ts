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
  formatDue,
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
/** An hour of a day, here. */
const at = (day: string, hour: number) => {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(year, month - 1, date, hour).getTime();
};

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

  it("puts to-dos without a due date last", () => {
    assert.equal(dueGroup(undefined, today), "later");
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
  it("moves to tomorrow", () => {
    assert.equal(snoozeTo("tomorrow", today), "2026-11-02");
  });

  it("moves to the next Monday, a week away on a Monday", () => {
    assert.equal(snoozeTo("next-week", today), "2026-11-02");
    assert.equal(snoozeTo("next-week", "2026-11-02"), "2026-11-09");
    assert.equal(snoozeTo("next-week", "2026-11-07"), "2026-11-09");
  });

  it("moves to the next Saturday, a week away on a Saturday", () => {
    assert.equal(snoozeTo("next-weekend", today), "2026-11-07");
    assert.equal(snoozeTo("next-weekend", "2026-11-06"), "2026-11-07");
    assert.equal(snoozeTo("next-weekend", "2026-11-07"), "2026-11-14");
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
    assert.equal(dueLabel(today, today, "en-US"), "Due today");
    assert.equal(dueLabel("2026-10-31", today, "en-US"), "Due yesterday");
    assert.equal(dueLabel("2026-11-06", today, "en-US"), "Due Friday");
    assert.equal(dueLabel("2026-11-08", today, "en-US"), "Due Nov 8");
  });
});

describe("isOverdue", () => {
  it("is overdue only while open and due before today", () => {
    const todo: Todo = { text: "", createdAt: 0, due: "2026-10-31" };
    assert.equal(isOverdue(todo, today), true);
    assert.equal(isOverdue({ ...todo, due: today }, today), false);
    assert.equal(isOverdue({ ...todo, doneAt: 1 }, today), false);
  });
});

/** A list of to-dos named by their IDs. */
function list(todos: Record<string, Partial<Todo>>): TodoListDoc {
  const doc = newTodoList();
  for (const [id, todo] of Object.entries(todos)) {
    doc.todos[id] = { text: id, createdAt: 0, ...todo };
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

describe("changes", () => {
  it("reopens a done to-do where it was", () => {
    const doc = newTodoList();
    addTodo(doc, "a", "A", 1);
    addTodo(doc, "b", "B", 2);
    setDone(doc, "a", true, at(today, 9));
    assert.deepEqual(ids(groupTodos(doc.todos, today).open), [["later", ["b"]]]);
    setDone(doc, "a", false);
    assert.equal("doneAt" in (doc.todos["a"] ?? {}), false);
    assert.deepEqual(ids(groupTodos(doc.todos, today).open), [["later", ["a", "b"]]]);
  });

  it("removes a due date or assignee rather than storing nothing", () => {
    const doc = newTodoList();
    addTodo(doc, "a", "A");
    setDue(doc, "a", today);
    setAssignee(doc, "a", "user");
    const todo = doc.todos["a"];
    assert.ok(todo);
    assert.equal(todo.due, today);
    assert.equal(todo.assignee, "user");
    setDue(doc, "a", null);
    setAssignee(doc, "a", null);
    assert.deepEqual(Object.keys(todo).toSorted(), ["createdAt", "text"]);
  });

  it("ignores changes to a to-do someone else deleted", () => {
    const doc = newTodoList();
    setDone(doc, "gone", true);
    setDue(doc, "gone", today);
    assert.deepEqual(doc.todos, {});
  });
});
