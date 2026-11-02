import { CalendarIcon, RotateCwFadingClockIcon, UserPlusIcon } from "lucide-react";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PeerAvatar } from "@/components/ui/peer";
import type { Todo } from "../../../shared/schema.ts";
import { useAutomergeText } from "../../hooks/useAutomergeText.ts";
import { initials } from "../../initials.ts";
import {
  dueLabel,
  dueOf,
  findAssignee,
  isOverdue,
  setAssignee,
  setDone,
  setDue,
  type When,
} from "../../todos.ts";
import { AssigneePicker } from "./AssigneePicker.tsx";
import { DuePopover } from "./DuePopover.tsx";
import { RevealOnHover } from "./RevealOnHover.tsx";
import type { TodoListContext } from "./TodoListEditor.tsx";

interface TodoRowProps {
  id: string;
  todo: Todo;
  /** The first in its box, so without a line above it. */
  isFirst: boolean;
  context: TodoListContext;
}

/**
 * One to-do: a checkbox and its text, with when it's due underneath. At the end, buttons to snooze
 * it and its assignee (or a button to assign it).
 */
export function TodoRow({ id, todo, isFirst, context }: TodoRowProps) {
  const { handle, today, people, newTodo, addTodo, leaveTodo } = context;
  const path = useMemo(() => ["todos", id, "text"], [id]);
  const { ref: bindText, ...text } = useAutomergeText(handle, path);
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const isNew = newTodo === id;
  const isDone = todo.doneAt !== undefined;
  const when: When =
    todo.time === undefined ? { due: dueOf(todo) } : { due: dueOf(todo), time: todo.time };
  const overdue = isOverdue(todo, today);
  const assignee = findAssignee(todo.assignee, people);
  const name = todo.text.trim() === "" ? "Untitled to-do" : todo.text;
  const changeDue = (next: When) => handle.change((doc) => setDue(doc, id, next));
  const changeAssignee = (person: string | null) =>
    handle.change((doc) => setAssignee(doc, id, person));

  // Before paint, while still handling the tap that added it (see addTodo).
  useLayoutEffect(() => {
    if (!isNew) return;
    textarea.current?.focus();
    textarea.current?.scrollIntoView({ block: "nearest" });
  }, [isNew]);

  return (
    <li className="group/todo flex items-start gap-3">
      {/* As tall as the first line of text, so the checkbox sits beside it. */}
      <span className="mt-2 flex h-7 w-5 shrink-0 items-center justify-center">
        <Checkbox
          checked={isDone}
          onCheckedChange={(checked) => handle.change((doc) => setDone(doc, id, checked))}
          aria-label={name}
        />
      </span>
      {/* The line between to-dos starts at their text, as this does. */}
      <div
        className={
          isFirst
            ? "flex min-w-0 flex-1 flex-col py-2"
            : "flex min-w-0 flex-1 flex-col border-t py-2"
        }
      >
        <div className="flex items-start gap-1">
          <textarea
            {...text}
            ref={(element) => {
              bindText(element);
              textarea.current = element;
            }}
            rows={1}
            aria-label="To-do"
            placeholder="New to-do"
            // Grows to fit as it wraps.
            className={
              isDone
                ? "field-sizing-content min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-5 text-muted-foreground line-through outline-none md:text-sm"
                : "field-sizing-content min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-5 outline-none placeholder:text-muted-foreground md:text-sm"
            }
            onBlur={() => leaveTodo(id)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              // Enter starts the next to-do, or, on an empty one, stops adding them.
              event.preventDefault();
              if (event.currentTarget.value.trim() === "") event.currentTarget.blur();
              else addTodo();
            }}
          />
          {!isDone && (
            <DuePopover
              when={when}
              today={today}
              onChange={changeDue}
              trigger={<Button variant="ghost" size="icon-sm" aria-label="Snooze" />}
            >
              <RotateCwFadingClockIcon />
            </DuePopover>
          )}
          {assignee ? (
            <AssigneePicker
              assignee={todo.assignee}
              people={people}
              onChange={changeAssignee}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Assigned to ${assignee.name}. Reassign`}
                />
              }
            >
              <PeerAvatar hue={assignee.hue} aria-hidden="true">
                {initials(assignee.name)}
              </PeerAvatar>
            </AssigneePicker>
          ) : (
            !isDone && (
              <RevealOnHover>
                <AssigneePicker
                  assignee={todo.assignee}
                  people={people}
                  onChange={changeAssignee}
                  trigger={<Button variant="ghost" size="icon-sm" aria-label="Assign" />}
                >
                  <UserPlusIcon />
                </AssigneePicker>
              </RevealOnHover>
            )
          )}
        </div>
        <span
          className={
            overdue
              ? "flex items-center gap-1 pb-1 text-xs text-destructive"
              : "flex items-center gap-1 pb-1 text-xs text-muted-foreground"
          }
        >
          <CalendarIcon aria-hidden="true" className="size-3 shrink-0" />
          {dueLabel(when, today)}
          {overdue && <span className="sr-only">, overdue</span>}
        </span>
      </div>
    </li>
  );
}
