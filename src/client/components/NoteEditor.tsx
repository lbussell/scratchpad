import type { AutomergeUrl } from "@automerge/automerge-repo";
import { automergeSyncPlugin } from "@automerge/automerge-codemirror";
import { useDocHandle } from "@automerge/automerge-repo-react-hooks";
import { EditorView, placeholder } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import type { NoteDoc } from "../../shared/schema.ts";

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
