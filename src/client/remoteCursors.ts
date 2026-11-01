import { type Cursor, getCursor, getCursorPosition, type Prop } from "@automerge/automerge-repo";
import { type Range, StateEffect } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { Color } from "../shared/schema.ts";
import type { NotePresence } from "./presence.ts";

/** Re-resolves peers' cursors against the current document. */
const refreshCursors = StateEffect.define();

// Lightness and chroma are theme tokens so every user's color is equally visible; only hue varies.
// --peer-tint is 0 for Neutral users, whose cursors are gray.
const peerColor = (alpha = 1) =>
  `oklch(var(--presence-lightness) calc(var(--presence-chroma) * var(--peer-tint)) var(--peer-hue) / ${alpha})`;

/** CSS custom properties that color a peer's cursor and selection (see peerColor). */
function peerColorProperties(hue: Color): string {
  return `--peer-hue: ${hue ?? 0}; --peer-tint: ${hue === null ? 0 : 1};`;
}

const theme = EditorView.baseTheme({
  ".cm-remote-selection": { backgroundColor: peerColor(0.25) },
  ".cm-remote-caret": {
    position: "relative",
    marginInline: "-1px",
    borderLeft: `2px solid ${peerColor()}`,
    pointerEvents: "none",
  },
  ".cm-remote-caret::before": {
    content: '""',
    position: "absolute",
    top: "-4px",
    left: "-4px",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: peerColor(),
  },
});

class CaretWidget extends WidgetType {
  readonly hue: Color;

  constructor(hue: Color) {
    super();
    this.hue = hue;
  }

  override eq(other: CaretWidget): boolean {
    return other.hue === this.hue;
  }

  toDOM(): HTMLElement {
    const caret = document.createElement("span");
    caret.className = "cm-remote-caret";
    caret.setAttribute("style", peerColorProperties(this.hue));
    caret.setAttribute("aria-hidden", "true");
    return caret;
  }
}

/**
 * Shows other people's carets and selections in the text at `path`, each in their user's color,
 * and shares our caret and the character under our mouse with them.
 */
export function remoteCursors(presence: NotePresence, path: Prop[]) {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      readonly #view: EditorView;
      readonly #unsubscribe: () => void;
      #broadcastScheduled = false;
      #hasUnresolvedCursors = false;
      #destroyed = false;
      /** Where the mouse is, while it's over the editor. */
      #mouse: { x: number; y: number } | null = null;

      constructor(view: EditorView) {
        this.#view = view;
        this.#unsubscribe = presence.subscribe(this.#refresh);
        view.scrollDOM.addEventListener("scroll", this.#sharePointer, { passive: true });
        view.dom.addEventListener("mousemove", this.#onMouseMove);
        view.dom.addEventListener("mouseleave", this.#onMouseLeave);
        this.#scheduleBroadcast();
        queueMicrotask(this.#refresh);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged) this.decorations = this.decorations.map(update.changes);
        const refreshed = update.transactions.some((tr) =>
          tr.effects.some((effect) => effect.is(refreshCursors)),
        );
        if (refreshed) {
          this.decorations = this.#resolvePeerCursors();
        } else if (update.docChanged && this.#hasUnresolvedCursors) {
          // A peer's cursor may point at text that just arrived.
          queueMicrotask(this.#refresh);
        }
        if (update.selectionSet || update.docChanged || update.focusChanged) {
          this.#scheduleBroadcast();
        }
      }

      destroy(): void {
        this.#destroyed = true;
        this.#unsubscribe();
        this.#view.scrollDOM.removeEventListener("scroll", this.#sharePointer);
        this.#view.dom.removeEventListener("mousemove", this.#onMouseMove);
        this.#view.dom.removeEventListener("mouseleave", this.#onMouseLeave);
        presence.setSelection(null);
        presence.setPointer(null);
      }

      #refresh = () => {
        if (!this.#destroyed) this.#view.dispatch({ effects: refreshCursors.of(null) });
      };

      #onMouseMove = (event: MouseEvent) => {
        this.#mouse = { x: event.clientX, y: event.clientY };
        this.#sharePointer();
      };

      #onMouseLeave = () => {
        this.#mouse = null;
        this.#sharePointer();
      };

      /** Also runs on scroll, which moves the text under a still mouse. */
      #sharePointer = () => {
        const position = this.#mouse && this.#view.posAtCoords(this.#mouse, false);
        presence.setPointer(position === null ? null : this.#cursorAt(position));
      };

      #scheduleBroadcast(): void {
        if (this.#broadcastScheduled) return;
        this.#broadcastScheduled = true;
        // Wait until the edit that triggered this has reached the Automerge document.
        queueMicrotask(() => {
          this.#broadcastScheduled = false;
          if (this.#destroyed) return;
          presence.setSelection(this.#view.hasFocus ? this.#localSelection() : null);
          // Typing moves the text under the mouse.
          if (this.#mouse) this.#sharePointer();
        });
      }

      #cursorAt(position: number): Cursor | null {
        const length = this.#view.state.doc.length;
        try {
          return getCursor(presence.handle.fullDoc(), path, position >= length ? "end" : position);
        } catch {
          return null;
        }
      }

      #localSelection() {
        const { anchor, head } = this.#view.state.selection.main;
        const anchorCursor = this.#cursorAt(anchor);
        const headCursor = this.#cursorAt(head);
        return anchorCursor && headCursor ? { anchor: anchorCursor, head: headCursor } : null;
      }

      #resolvePeerCursors(): DecorationSet {
        this.#hasUnresolvedCursors = false;
        const decorations: Range<Decoration>[] = [];
        for (const { state } of presence.peers()) {
          if (!state.selection) continue;
          const anchor = resolveCursor(presence, path, state.selection.anchor, this.#view);
          const head = resolveCursor(presence, path, state.selection.head, this.#view);
          if (anchor === undefined || head === undefined) {
            this.#hasUnresolvedCursors = true;
            continue;
          }
          const { hue } = state.user;
          if (anchor !== head) {
            const mark = Decoration.mark({
              class: "cm-remote-selection",
              attributes: { style: peerColorProperties(hue) },
            });
            decorations.push(mark.range(Math.min(anchor, head), Math.max(anchor, head)));
          }
          decorations.push(
            Decoration.widget({ widget: new CaretWidget(hue), side: 1 }).range(head),
          );
        }
        return Decoration.set(decorations, true);
      }
    },
    { decorations: (instance) => instance.decorations },
  );
  return [plugin, theme];
}

/** Where a peer's cursor is in the editor's text, or undefined if we don't have that text yet. */
export function resolveCursor(
  presence: NotePresence,
  path: Prop[],
  cursor: Cursor,
  view: EditorView,
): number | undefined {
  try {
    return Math.min(
      getCursorPosition(presence.handle.fullDoc(), path, cursor),
      view.state.doc.length,
    );
  } catch {
    return undefined;
  }
}
