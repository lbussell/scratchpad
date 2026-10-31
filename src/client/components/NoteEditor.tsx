import type { AutomergeUrl } from "@automerge/automerge-repo";
import { automergeSyncPlugin } from "@automerge/automerge-codemirror";
import { useDocHandle } from "@automerge/automerge-repo-react-hooks";
import { EditorView, placeholder } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { useEffect, useEffectEvent, useRef } from "react";
import type { NoteDoc } from "../../shared/schema.ts";
import { useCurrentUser } from "../hooks/useCurrentUser.ts";
import { remoteCursors, setCursorUser } from "../remoteCursors.ts";

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
  const viewRef = useRef<EditorView | null>(null);
  const { id: userId, hue } = useCurrentUser().user;
  // The editor is built once per note; later color changes go through setCursorUser below.
  const initialCursorUser = useEffectEvent(() => ({ id: userId, hue }));

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return undefined;

    const view = new EditorView({
      doc: handle.doc().text,
      extensions: [
        minimalSetup,
        editorTheme,
        EditorView.lineWrapping,
        placeholder("Start typing…"),
        EditorView.contentAttributes.of({ "aria-label": "Note" }),
        automergeSyncPlugin({ handle, path: ["text"] }),
        remoteCursors(handle, ["text"], initialCursorUser()),
      ],
      parent,
    });
    // The editor loads lazily, so don't steal focus from someone already typing, e.g. in the
    // title of a new note (see NoteTitle).
    const { activeElement } = document;
    const isTyping =
      activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
    if (!isTyping) view.focus();
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [handle]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setCursorUser.of({ id: userId, hue }) });
  }, [userId, hue]);

  return <div className="h-full" ref={containerRef} />;
}
