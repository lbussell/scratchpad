import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import {
  automergeSyncPlugin,
  type DocHandle as EditorHandle,
} from "@automerge/automerge-codemirror";
import { useDocHandle } from "@automerge/automerge-repo-react-hooks";
import { EditorView, placeholder } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import type { NoteDoc } from "../../shared/schema.ts";
import { useNotePresence } from "../presence.ts";
import { remoteCursors } from "../remoteCursors.ts";

// CodeMirror's default theme hardcodes light-mode colors and is injected at runtime with
// selectors plain CSS can't easily beat, so override it here using the shadcn theme variables.
const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "1rem" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    padding: "calc(var(--spacing) * 6) calc(var(--spacing) * 8)",
    fontFamily: "inherit",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "color-mix(in oklch, var(--primary) 25%, transparent)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
});

export function NoteEditor({ url }: { url: AutomergeUrl }) {
  const handle = useDocHandle<NoteDoc>(url, { suspense: true });
  const containerRef = useRef<HTMLDivElement>(null);
  const presence = useNotePresence(handle);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return undefined;

    const view = new EditorView({
      doc: handle.fullDoc().text,
      extensions: [
        minimalSetup,
        editorTheme,
        EditorView.lineWrapping,
        placeholder("Start typing…"),
        EditorView.contentAttributes.of({ "aria-label": "Note" }),
        automergeSyncPlugin({ handle: editorHandle(handle), path: ["text"] }),
        remoteCursors(presence, ["text"]),
      ],
      parent,
    });
    // The editor loads lazily, so don't steal focus from someone already typing, e.g. in the
    // title of a new note (see NoteTitle).
    const { activeElement } = document;
    const isTyping =
      activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
    if (!isTyping) view.focus();
    // So the eyes beside the title can find positions in the text on screen.
    presence.setView(view);
    return () => {
      presence.setView(null);
      view.destroy();
    };
  }, [handle, presence]);

  return <div className="h-full" ref={containerRef} />;
}

/**
 * The note's handle as the CodeMirror plugin wants it. automerge-repo 2.6 types `doc()` as possibly
 * undefined, for handles on part of a document; a handle on a whole document always has one.
 */
function editorHandle(handle: DocHandle<NoteDoc>): EditorHandle<unknown> {
  return {
    isReady: () => handle.isReady(),
    doc: () => handle.fullDoc(),
    change: (callback) => {
      handle.change(callback);
    },
    on: (event, callback) => handle.on(event, callback),
    off: (event, callback) => handle.off(event, callback),
  };
}
