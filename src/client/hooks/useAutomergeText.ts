import {
  type DocHandle,
  type DocHandleChangePayload,
  type Patch,
  type Prop,
  updateText,
} from "@automerge/automerge-repo";
import {
  type ChangeEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

type TextElement = HTMLInputElement | HTMLTextAreaElement;

interface Selection {
  start: number;
  end: number;
  direction: TextElement["selectionDirection"];
}

/**
 * Binds an `<input>` or `<textarea>` to a string in an Automerge document: local edits are merged
 * character by character, and the caret stays put when other people edit the same text.
 *
 * Spread the result onto the element: `<input {...useAutomergeText(handle, path)} />`. `path` must
 * be stable across renders, e.g. a module-level constant. A missing string reads as "".
 */
export function useAutomergeText<T extends object>(handle: DocHandle<T>, path: Prop[]) {
  const elementRef = useRef<TextElement | null>(null);
  // Where the selection belongs once React renders the latest remote text.
  const pendingSelection = useRef<Selection | null>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const onChange = ({ doc, patches }: DocHandleChangePayload<T>) => {
        // Runs before React re-renders, so the element still shows the old text and selection.
        const element = elementRef.current;
        const isRemoteEdit = element !== null && element.value !== readText(doc, path);
        if (isRemoteEdit && element === document.activeElement) {
          const selection = pendingSelection.current ?? readSelection(element);
          pendingSelection.current = mapSelection(selection, patches, path);
        }
        onStoreChange();
      };
      handle.on("change", onChange);
      return () => {
        handle.off("change", onChange);
      };
    },
    [handle, path],
  );

  const value = useSyncExternalStore(subscribe, () => readText(handle.fullDoc(), path));

  // Rendering remote text moves the caret to the end, so put it back where it belongs.
  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    pendingSelection.current = null;
    if (selection) {
      const { start, end, direction } = selection;
      elementRef.current?.setSelectionRange(start, end, direction ?? undefined);
    }
  });

  const onChange = useCallback(
    (event: ChangeEvent<TextElement>) => {
      const text = event.target.value;
      handle.change((doc: T) => {
        writeText(doc, path, text);
      });
    },
    [handle, path],
  );

  const ref = useCallback((element: TextElement | null) => {
    elementRef.current = element;
  }, []);

  return { value, onChange, ref };
}

function readText(doc: unknown, path: Prop[]): string {
  let value = doc;
  for (const key of path) {
    if (typeof value !== "object" || value === null) return "";
    value = Reflect.get(value, key);
  }
  return typeof value === "string" ? value : "";
}

function writeText(doc: object, path: Prop[], text: string): void {
  const parent = path.slice(0, -1).reduce<unknown>((value, key) => {
    if (typeof value !== "object" || value === null) throw new Error(`No object at ${key}`);
    return Reflect.get(value, key);
  }, doc);
  const key = path.at(-1);
  if (typeof parent !== "object" || parent === null || key === undefined) {
    throw new Error(`Can't write text at ${path.join(".")}`);
  }
  if (typeof Reflect.get(parent, key) === "string") {
    // Diffs against the current text, so concurrent edits merge instead of overwriting.
    updateText(doc, path, text);
  } else {
    // Older documents may not have this field yet.
    Reflect.set(parent, key, text);
  }
}

function readSelection(element: TextElement): Selection {
  return {
    start: element.selectionStart ?? element.value.length,
    end: element.selectionEnd ?? element.value.length,
    direction: element.selectionDirection,
  };
}

function mapSelection(selection: Selection, patches: Patch[], path: Prop[]): Selection {
  let { start, end } = selection;
  for (const patch of patches) {
    const index = textIndex(patch, path);
    if (index === undefined) continue;
    if (patch.action === "splice") {
      // Text inserted exactly at the caret goes after it.
      if (index < start) start += patch.value.length;
      if (index < end) end += patch.value.length;
    } else if (patch.action === "del") {
      const length = patch.length ?? 1;
      if (index < start) start = Math.max(index, start - length);
      if (index < end) end = Math.max(index, end - length);
    }
  }
  return { start, end, direction: selection.direction };
}

/** The character index a patch edits within the text at `path`, if it edits that text. */
function textIndex(patch: Patch, path: Prop[]): number | undefined {
  if (patch.path.length !== path.length + 1) return undefined;
  if (!path.every((key, i) => patch.path[i] === key)) return undefined;
  const index = patch.path.at(-1);
  return typeof index === "number" ? index : undefined;
}
