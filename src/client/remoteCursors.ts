import {
  type Cursor,
  type DocHandle,
  getCursor,
  getCursorPosition,
  Presence,
  type Prop,
} from "@automerge/automerge-repo";
import { type Range, StateEffect } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { UserProfile } from "../shared/schema.ts";

/** What peers need to know about a user to draw their cursor. */
export type CursorUser = Pick<UserProfile, "id" | "hue">;

/** What each peer shares about itself, over Automerge's ephemeral messages. */
type CursorPresence = {
  user: CursorUser;
  /**
   * Automerge cursors rather than indexes, so they point at the same characters on every peer
   * even while edits are in flight. Null while the editor doesn't have focus.
   */
  selection: { anchor: Cursor; head: Cursor } | null;
};

/** Re-resolves peers' cursors against the current document. */
const refreshCursors = StateEffect.define();

// Lightness and chroma are theme tokens so every user's color is equally visible; only hue varies.
const peerColor = (alpha = 1) =>
  `oklch(var(--presence-lightness) var(--presence-chroma) var(--peer-hue) / ${alpha})`;

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
  readonly hue: number;

  constructor(hue: number) {
    super();
    this.hue = hue;
  }

  override eq(other: CaretWidget): boolean {
    return other.hue === this.hue;
  }

  toDOM(): HTMLElement {
    const caret = document.createElement("span");
    caret.className = "cm-remote-caret";
    caret.style.setProperty("--peer-hue", String(this.hue));
    caret.setAttribute("aria-hidden", "true");
    return caret;
  }
}

/**
 * Shows other people's carets and selections in the text at `path`, each in their user's color,
 * and shares ours with them.
 */
export function remoteCursors(handle: DocHandle<unknown>, path: Prop[], user: CursorUser) {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      readonly #view: EditorView;
      readonly #presence = new Presence<CursorPresence>({ handle });
      #lastBroadcast = "null";
      #broadcastScheduled = false;
      #hasUnresolvedCursors = false;
      #destroyed = false;

      constructor(view: EditorView) {
        this.#view = view;
        this.#start();
        for (const event of ["update", "snapshot", "goodbye", "pruning"] as const) {
          this.#presence.on(event, this.#refresh);
        }
        // Say goodbye when the page goes away so our caret disappears right away, rather than
        // when peers time us out. Pages can come back from the back/forward cache.
        window.addEventListener("pagehide", this.#stop);
        window.addEventListener("pageshow", this.#start);
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
        this.#stop();
        this.#presence.removeAllListeners();
        window.removeEventListener("pagehide", this.#stop);
        window.removeEventListener("pageshow", this.#start);
      }

      #start = () => {
        if (this.#presence.running) return;
        this.#lastBroadcast = "null";
        this.#presence.start({ initialState: { user, selection: null } });
        this.#scheduleBroadcast();
      };

      #stop = () => {
        if (this.#presence.running) this.#presence.stop();
      };

      #refresh = () => {
        if (!this.#destroyed) this.#view.dispatch({ effects: refreshCursors.of(null) });
      };

      #scheduleBroadcast(): void {
        if (this.#broadcastScheduled) return;
        this.#broadcastScheduled = true;
        // Wait until the edit that triggered this has reached the Automerge document.
        queueMicrotask(() => {
          this.#broadcastScheduled = false;
          if (this.#destroyed || !this.#presence.running) return;
          const selection = this.#view.hasFocus ? this.#localSelection() : null;
          const serialized = JSON.stringify(selection);
          if (serialized === this.#lastBroadcast) return;
          this.#lastBroadcast = serialized;
          this.#presence.broadcast("selection", selection);
        });
      }

      #localSelection(): CursorPresence["selection"] {
        const doc = handle.doc();
        const length = this.#view.state.doc.length;
        const { anchor, head } = this.#view.state.selection.main;
        try {
          return {
            anchor: getCursor(doc, path, anchor >= length ? "end" : anchor),
            head: getCursor(doc, path, head >= length ? "end" : head),
          };
        } catch {
          return null;
        }
      }

      #resolvePeerCursors(): DecorationSet {
        const doc = handle.doc();
        const length = this.#view.state.doc.length;
        const resolve = (cursor: Cursor) => {
          try {
            return Math.min(getCursorPosition(doc, path, cursor), length);
          } catch {
            // Points at text we haven't received yet.
            return undefined;
          }
        };

        this.#hasUnresolvedCursors = false;
        const decorations: Range<Decoration>[] = [];
        for (const { value } of Object.values(this.#presence.getPeerStates().value)) {
          // Peers' state comes off the network, so check it.
          if (!isCursorPresence(value) || !value.selection) continue;
          const anchor = resolve(value.selection.anchor);
          const head = resolve(value.selection.head);
          if (anchor === undefined || head === undefined) {
            this.#hasUnresolvedCursors = true;
            continue;
          }
          const { hue } = value.user;
          if (anchor !== head) {
            const mark = Decoration.mark({
              class: "cm-remote-selection",
              attributes: { style: `--peer-hue: ${hue}` },
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

function isCursorPresence(value: unknown): value is CursorPresence {
  if (typeof value !== "object" || value === null) return false;
  if (!("user" in value) || !isCursorUser(value.user) || !("selection" in value)) return false;
  const { selection } = value;
  return (
    selection === null ||
    (typeof selection === "object" &&
      "anchor" in selection &&
      typeof selection.anchor === "string" &&
      "head" in selection &&
      typeof selection.head === "string")
  );
}

function isCursorUser(value: unknown): value is CursorUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "hue" in value &&
    typeof value.hue === "number" &&
    Number.isFinite(value.hue)
  );
}
