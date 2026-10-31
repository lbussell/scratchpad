import type { AutomergeUrl } from "@automerge/automerge-repo";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { NoteEditor } from "./components/NoteEditor.tsx";
import { NoteList } from "./components/NoteList.tsx";
import { useSelectedNote } from "./hooks/useSelectedNote.ts";

export function App({ rootDocUrl }: { rootDocUrl: AutomergeUrl }) {
  const [selected, select] = useSelectedNote();

  return (
    <div className="app">
      <aside className="sidebar">
        <ErrorBoundary fallback={<p className="status">Couldn’t load notes.</p>}>
          <Suspense fallback={<p className="status">Loading notes…</p>}>
            <NoteList rootDocUrl={rootDocUrl} selected={selected} onSelect={select} />
          </Suspense>
        </ErrorBoundary>
      </aside>
      <main className="editor-pane">
        {selected ? (
          <ErrorBoundary key={selected} fallback={<p className="status">Couldn’t load note.</p>}>
            <Suspense fallback={<p className="status">Loading note…</p>}>
              <NoteEditor key={selected} url={selected} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <p className="status">Select a note, or create a new one.</p>
        )}
      </main>
    </div>
  );
}
