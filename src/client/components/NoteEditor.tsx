import type { AutomergeUrl } from "@automerge/automerge-repo";
import { automergeSyncPlugin } from "@automerge/automerge-codemirror";
import { useDocHandle } from "@automerge/automerge-repo-react-hooks";
import { EditorView, placeholder } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import type { NoteDoc } from "../../shared/schema.ts";

// CodeMirror's default theme hardcodes light-mode colors and is injected at runtime with
// selectors plain CSS can't easily beat, so override it here using the app's CSS variables.
const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "1rem" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { padding: "24px 32px", fontFamily: "inherit" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fg)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "var(--text-selection)" },
  ".cm-placeholder": { color: "var(--fg-muted)" },
});

export function NoteEditor({ url }: { url: AutomergeUrl }) {
  const handle = useDocHandle<NoteDoc>(url, { suspense: true });
  const containerRef = useRef<HTMLDivElement>(null);

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
        automergeSyncPlugin({ handle, path: ["text"] }),
      ],
      parent,
    });
    view.focus();
    return () => view.destroy();
  }, [handle]);

  return <div className="note-editor" ref={containerRef} />;
}
