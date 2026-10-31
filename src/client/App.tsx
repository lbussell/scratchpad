import type { AutomergeUrl } from "@automerge/automerge-repo";
import { NotebookPenIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import {
  Sidebar,
  SidebarFooter,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ConnectionIndicator } from "./components/ConnectionIndicator.tsx";
import { DocumentBoundary } from "./components/DocumentBoundary.tsx";
import { NoteList } from "./components/NoteList.tsx";
import { NoteTitle } from "./components/NoteTitle.tsx";
import { StatusMessage } from "./components/StatusMessage.tsx";
import { ThemeToggle } from "./components/ThemeToggle.tsx";
import { useConnectionStatus } from "./hooks/useConnectionStatus.ts";
import { useSelectedNote } from "./hooks/useSelectedNote.ts";
import type { ServerConnection } from "./serverConnection.ts";

// CodeMirror is a large share of the bundle and isn't needed until a note is open.
const NoteEditor = lazy(async () => {
  const module = await import("./components/NoteEditor.tsx");
  return { default: module.NoteEditor };
});

interface AppProps {
  rootDocUrl: AutomergeUrl;
  serverConnection: ServerConnection;
}

export function App({ rootDocUrl, serverConnection }: AppProps) {
  const [selected, select] = useSelectedNote();
  const connectionStatus = useConnectionStatus(serverConnection);

  return (
    <SidebarProvider className="h-svh">
      <Sidebar>
        <DocumentBoundary
          url={rootDocUrl}
          fallback={
            <StatusMessage pending>Couldn’t load notes. Waiting for the server…</StatusMessage>
          }
        >
          <Suspense fallback={<StatusMessage pending>Loading notes…</StatusMessage>}>
            <NoteList rootDocUrl={rootDocUrl} selected={selected} onSelect={select} />
          </Suspense>
        </DocumentBoundary>
        <SidebarFooter className="flex-row items-start justify-between">
          <ConnectionIndicator status={connectionStatus} />
          <ThemeToggle />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
          <SidebarTrigger />
          {selected && <NoteTitle key={selected} url={selected} />}
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          {selected ? (
            <DocumentBoundary
              key={selected}
              url={selected}
              fallback={
                <StatusMessage pending>Couldn’t load note. Waiting for the server…</StatusMessage>
              }
            >
              <Suspense fallback={<StatusMessage pending>Loading note…</StatusMessage>}>
                <NoteEditor key={selected} url={selected} />
              </Suspense>
            </DocumentBoundary>
          ) : (
            <StatusMessage icon={<NotebookPenIcon />}>
              Select a note, or create a new one.
            </StatusMessage>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
