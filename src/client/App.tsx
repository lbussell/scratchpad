import type { AutomergeUrl } from "@automerge/automerge-repo";
import { Suspense } from "react";
import { ConnectionIndicator } from "./components/ConnectionIndicator.tsx";
import { DocumentBoundary } from "./components/DocumentBoundary.tsx";
import { NoteEditor } from "./components/NoteEditor.tsx";
import { NoteList } from "./components/NoteList.tsx";
import { useConnectionStatus } from "./hooks/useConnectionStatus.ts";
import { useSelectedNote } from "./hooks/useSelectedNote.ts";
import type { ServerConnection } from "./serverConnection.ts";

interface AppProps {
  rootDocUrl: AutomergeUrl;
  serverConnection: ServerConnection;
}

export function App({ rootDocUrl, serverConnection }: AppProps) {
  const [selected, select] = useSelectedNote();
  const connectionStatus = useConnectionStatus(serverConnection);

  return (
    <div className="app">
      <aside className="sidebar">
        <DocumentBoundary
          url={rootDocUrl}
          fallback={<p className="status">Couldn’t load notes. Waiting for the server…</p>}
        >
          <Suspense fallback={<p className="status">Loading notes…</p>}>
            <NoteList rootDocUrl={rootDocUrl} selected={selected} onSelect={select} />
          </Suspense>
        </DocumentBoundary>
        <footer className="sidebar-footer">
          <ConnectionIndicator status={connectionStatus} />
        </footer>
      </aside>
      <main className="editor-pane">
        {selected ? (
          <DocumentBoundary
            key={selected}
            url={selected}
            fallback={<p className="status">Couldn’t load note. Waiting for the server…</p>}
          >
            <Suspense fallback={<p className="status">Loading note…</p>}>
              <NoteEditor key={selected} url={selected} />
            </Suspense>
          </DocumentBoundary>
        ) : (
          <p className="status">Select a note, or create a new one.</p>
        )}
      </main>
    </div>
  );
}
