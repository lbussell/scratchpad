import { useCallback, useState } from "react";
import type { FolderId } from "../../shared/schema.ts";

const STORAGE_KEY = "scratchpad:collapsed-folders";

/**
 * Which folders are closed in the sidebar. Folders start open; closing one is remembered on this
 * device only, since it's a matter of what each person wants to see.
 */
export function useCollapsedFolders(): [
  isCollapsed: (id: FolderId) => boolean,
  setCollapsed: (id: FolderId, collapsed: boolean) => void,
] {
  const [collapsed, setCollapsedSet] = useState(load);

  const isCollapsed = useCallback((id: FolderId) => collapsed.has(id), [collapsed]);
  const setCollapsed = useCallback((id: FolderId, value: boolean) => {
    setCollapsedSet((current) => {
      if (current.has(id) === value) return current;
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      save(next);
      return next;
    });
  }, []);

  return [isCollapsed, setCollapsed];
}

function load(): ReadonlySet<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function save(collapsed: ReadonlySet<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Storage can be full or disabled; folders just reopen next time.
  }
}
