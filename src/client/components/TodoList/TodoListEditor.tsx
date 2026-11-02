import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useDocHandle, useDocument } from "@automerge/automerge-repo-react-hooks";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import type { Person, TodoListDoc } from "../../../shared/schema.ts";
import { usePeople } from "../../hooks/usePeople.ts";
import { useToday } from "../../hooks/useToday.ts";
import { addTodo, type Day, deleteTodo, groupTodos, type TodoGroup } from "../../todos.ts";
import { TodoRow } from "./TodoRow.tsx";

/** What every row needs, besides its own to-do. */
export interface TodoListContext {
  handle: DocHandle<TodoListDoc>;
  today: Day;
  people: readonly Person[];
  /** The to-do just added here, which has focus until it's left. */
  newTodo: string | null;
  /** Adds an empty to-do and focuses it. */
  addTodo: () => void;
  /** Call when a to-do loses focus. A new one that's still empty wasn't wanted after all. */
  leaveTodo: (id: string) => void;
}

/**
 * A to-do list: open to-dos grouped by when they're due, then done to-dos grouped by when they
 * were done. Each group is a box, with its heading lined up with the to-dos' text.
 */
export function TodoListEditor({ url }: { url: AutomergeUrl }) {
  const handle = useDocHandle<TodoListDoc>(url, { suspense: true });
  const [doc] = useDocument<TodoListDoc>(url, { suspense: true });
  const today = useToday();
  const people = usePeople();
  const [newTodo, setNewTodo] = useState<string | null>(null);
  // Focus moves to a newer to-do before the last one hears it lost focus, so check the latest.
  const newTodoRef = useRef<string | null>(null);
  const { open, done } = useMemo(() => groupTodos(doc.todos, today), [doc.todos, today]);

  const context: TodoListContext = {
    handle,
    today,
    people,
    newTodo,
    addTodo: () => {
      const id = crypto.randomUUID();
      // Renders the new row, and focuses it, before this returns: phones only open the keyboard
      // for focus that moves while handling the tap.
      flushSync(() => {
        handle.change((list) => addTodo(list, id, { text: "", due: today }));
        newTodoRef.current = id;
        setNewTodo(id);
      });
    },
    leaveTodo: (id) => {
      if (id !== newTodoRef.current) return;
      if (handle.fullDoc().todos[id]?.text.trim() === "") {
        handle.change((list) => deleteTodo(list, id));
      }
      newTodoRef.current = null;
      setNewTodo(null);
    },
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4 sm:px-8">
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" aria-label="New to-do" onClick={context.addTodo}>
            <PlusIcon />
          </Button>
        </div>
        {open.length === 0 && done.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Nothing to do.</p>
        )}
        {open.map((group) => (
          <section key={group.id} aria-label={group.label} className="flex flex-col gap-1.5">
            <h3 className="pl-11 text-sm font-medium text-muted-foreground">{group.label}</h3>
            <TodoBox group={group} context={context} />
          </section>
        ))}
        {done.map((group) => (
          <DoneGroup key={group.id} group={group} context={context} />
        ))}
      </div>
    </div>
  );
}

function DoneGroup({ group, context }: { group: TodoGroup<string>; context: TodoListContext }) {
  // What was done today is open to begin with; earlier groups, which only grow, are closed.
  const [isOpen, setOpen] = useState(group.id === "today");
  const boxId = useId();
  return (
    <section aria-label={group.label} className="flex flex-col gap-1.5">
      <h3 className="flex">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={boxId}
          onClick={() => setOpen(!isOpen)}
          className="flex items-center gap-3 rounded-md pl-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {/* In the checkboxes' column, so the label lines up with the to-dos' text. */}
          <span className="flex w-5 justify-center">
            {isOpen ? (
              <ChevronDownIcon aria-hidden="true" className="size-4" />
            ) : (
              <ChevronRightIcon aria-hidden="true" className="size-4" />
            )}
          </span>
          {group.label}
          <span className="tabular-nums">{group.todos.length}</span>
        </button>
      </h3>
      <div id={boxId} hidden={!isOpen}>
        <TodoBox group={group} context={context} />
      </div>
    </section>
  );
}

function TodoBox({ group, context }: { group: TodoGroup<string>; context: TodoListContext }) {
  return (
    <ul className="flex flex-col rounded-xl border bg-card px-3">
      {group.todos.map(({ id, todo }, index) => (
        <TodoRow key={id} id={id} todo={todo} isFirst={index === 0} context={context} />
      ))}
    </ul>
  );
}
