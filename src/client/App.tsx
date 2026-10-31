import type { AutomergeUrl } from "@automerge/automerge-repo";
import { NotebookPenIcon, SettingsIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import {
  Sidebar,
  SidebarFooter,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { CurrentUser } from "./components/CurrentUser.tsx";
import { DocumentBoundary } from "./components/DocumentBoundary.tsx";
import { NoteList } from "./components/NoteList.tsx";
import { NoteTitle } from "./components/NoteTitle.tsx";
import { OfflineBanner } from "./components/OfflineBanner.tsx";
import { SettingsPage } from "./components/SettingsPage.tsx";
import { StatusMessage } from "./components/StatusMessage.tsx";
import { useConnectionStatus } from "./hooks/useConnectionStatus.ts";
import { navigate, type Route, routeHref, useRoute } from "./hooks/useRoute.ts";
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
  const route = useRoute();
  const connectionStatus = useConnectionStatus(serverConnection);

  return (
    <SidebarProvider className="h-svh">
      <Sidebar>
        {connectionStatus === "offline" && (
          <div className="p-2 pb-0">
            <OfflineBanner />
          </div>
        )}
        <DocumentBoundary
          url={rootDocUrl}
          fallback={
            <StatusMessage pending>Couldn’t load notes. Waiting for the server…</StatusMessage>
          }
        >
          <Suspense fallback={<StatusMessage pending>Loading notes…</StatusMessage>}>
            <NoteList
              rootDocUrl={rootDocUrl}
              selected={route.page === "note" ? route.url : undefined}
              onSelect={(url) => navigate({ page: "note", url })}
            />
          </Suspense>
        </DocumentBoundary>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarLink route={{ page: "settings" }} isActive={route.page === "settings"}>
                <SettingsIcon />
                <span>Settings</span>
              </SidebarLink>
            </SidebarMenuItem>
          </SidebarMenu>
          <CurrentUser status={connectionStatus} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
          <SidebarTrigger />
          {route.page === "note" && <NoteTitle key={route.url} url={route.url} />}
          {route.page === "settings" && <h2 className="px-2.5 text-sm font-medium">Settings</h2>}
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <MainPane route={route} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function MainPane({ route }: { route: Route }) {
  if (route.page === "settings") return <SettingsPage />;
  if (route.page === "home") {
    return (
      <StatusMessage icon={<NotebookPenIcon />}>Select a note, or create a new one.</StatusMessage>
    );
  }
  return (
    <DocumentBoundary
      key={route.url}
      url={route.url}
      fallback={<StatusMessage pending>Couldn’t load note. Waiting for the server…</StatusMessage>}
    >
      <Suspense fallback={<StatusMessage pending>Loading note…</StatusMessage>}>
        <NoteEditor key={route.url} url={route.url} />
      </Suspense>
    </DocumentBoundary>
  );
}

interface SidebarLinkProps {
  route: Route;
  isActive: boolean;
  children: React.ReactNode;
}

function SidebarLink({ route, isActive, children }: SidebarLinkProps) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuButton
      isActive={isActive}
      render={(props) => (
        <a {...props} href={routeHref(route)} aria-current={isActive ? "page" : undefined}>
          {props.children}
        </a>
      )}
      // On mobile the sidebar is a drawer over the page, so get it out of the way.
      onClick={() => setOpenMobile(false)}
    >
      {children}
    </SidebarMenuButton>
  );
}
