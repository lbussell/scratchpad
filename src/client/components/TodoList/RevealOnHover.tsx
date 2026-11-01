import type { ReactNode } from "react";

/**
 * Wraps a to-do's control for adding something it doesn't have yet, so the list stays quiet:
 * hidden until the row is hovered or has focus, or the control's menu is open. Always shown on
 * touch screens, which can't hover.
 */
export function RevealOnHover({ children }: { children: ReactNode }) {
  return (
    <span className="flex opacity-0 group-focus-within/todo:opacity-100 group-hover/todo:opacity-100 has-aria-expanded:opacity-100 pointer-coarse:opacity-100">
      {children}
    </span>
  );
}
