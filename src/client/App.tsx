import { useDocHandle } from "@automerge/automerge-repo-react-hooks";
import { NotebookPenIcon, SettingsIcon } from "lucide-react";
import {
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
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
import { NewMenu } from "./components/NewMenu.tsx";
import { DocumentTree } from "./components/DocumentTree/DocumentTree.tsx";
import { NotePeers } from "./components/NotePeers.tsx";
import { NoteTitle } from "./components/NoteTitle.tsx";
import { OfflineBanner } from "./components/OfflineBanner.tsx";
import { SchemaMismatch } from "./components/SchemaMismatch.tsx";
import { SettingsPage } from "./components/SettingsPage.tsx";
import { StatusMessage } from "./components/StatusMessage.tsx";
import { useConnectionStatus } from "./hooks/useConnectionStatus.ts";
import { useDownloadAllDocuments } from "./hooks/useDownloadAllDocuments.ts";
import { useSchemaCompatibility } from "./hooks/useSchemaCompatibility.ts";
import { navigate, type Route, routeHref, useRoute } from "./hooks/useRoute.ts";
import type { FolderId, RootDoc, SessionResponse, UserProfile } from "../shared/schema.ts";
import { CurrentUserContext } from "./hooks/useCurrentUser.ts";
import { useWorkspacePresence } from "./presence.ts";
import type { ServerConnection } from "./serverConnection.ts";
import { fetchSession } from "./session.ts";
import { applyColor } from "./theme.ts";

// CodeMirror is a large share of the bundle and isn't needed until a note is open.
const NoteEditor = lazy(async () => {
  const module = await import("./components/NoteEditor.tsx");
  return { default: module.NoteEditor };
});

interface AppProps {
  session: SessionResponse;
  /** The session was saved from an earlier visit because the server didn't answer. */
  isSavedSession: boolean;
  serverConnection: ServerConnection;
}

export function App({ session, isSavedSession, serverConnection }: AppProps) {
  const { rootDocUrl, logoutUrl } = session;
  const route = useRoute();
  const connectionStatus = useConnectionStatus(serverConnection);
  const [user, setUser] = useState(session.user);
  const currentUser = useMemo(() => ({ user, setUser }), [user]);
  // Before paint, so a changed color never shows the old one.
  useLayoutEffect(() => applyColor(user.hue), [user.hue]);
  useRefreshSavedSession(isSavedSession && connectionStatus === "online", setUser);
  const compatibility = useSchemaCompatibility(rootDocUrl);
  const isCompatible = compatibility === "compatible";
  useDownloadAllDocuments(rootDocUrl, isCompatible && connectionStatus === "online");

  return (
    <CurrentUserContext.Provider value={currentUser}>
      {isCompatible ? (
        <Workspace
          rootDocUrl={rootDocUrl}
          logoutUrl={logoutUrl}
          route={route}
          connectionStatus={connectionStatus}
        />
      ) : (
        <SchemaMismatch status={compatibility} />
      )}
    </CurrentUserContext.Provider>
  );
}

/**
 * After starting from a saved session, fetches the current one once back online, in case the
 * profile changed on another device meanwhile.
 */
function useRefreshSavedSession(shouldRefresh: boolean, setUser: (user: UserProfile) => void) {
  const refreshed = useRef(false);
  useEffect(() => {
    if (!shouldRefresh || refreshed.current) return;
    refreshed.current = true;
    fetchSession().then(
      (session) => setUser(session.user),
      // Try again on the next reconnect.
      () => {
        refreshed.current = false;
      },
    );
  }, [shouldRefresh, setUser]);
}

interface WorkspaceProps {
  rootDocUrl: SessionResponse["rootDocUrl"];
  logoutUrl: string | null;
  route: Route;
  connectionStatus: ReturnType<typeof useConnectionStatus>;
}

function Workspace({ rootDocUrl, logoutUrl, route, connectionStatus }: WorkspaceProps) {
  const openDocument = route.page === "document" ? route.url : null;
  // Tells everyone which document we have open; the sidebar shows where everyone else is.
  const peers = useWorkspacePresence(useDocHandle<RootDoc>(rootDocUrl), openDocument);
  // The folder whose name is being edited, such as one just created.
  const [renaming, setRenaming] = useState<FolderId | null>(null);

  return (
    <>
      <SidebarProvider className="h-svh">
        <Sidebar>
          <SidebarHeader>
            <h1 className="p-2 font-heading text-base font-semibold">Scratchpad</h1>
          </SidebarHeader>
          <SidebarContent>
            {/* Grows so loading and error messages center in the space below the button. */}
            <SidebarGroup className="flex-1">
              <NewMenu
                rootDocUrl={rootDocUrl}
                onCreateNote={(url) => navigate({ page: "document", url })}
                onCreateFolder={setRenaming}
              />
              <DocumentBoundary
                url={rootDocUrl}
                fallback={
                  <StatusMessage pending>
                    Couldn’t load documents. Waiting for the server…
                  </StatusMessage>
                }
              >
                <Suspense fallback={<StatusMessage pending>Loading documents…</StatusMessage>}>
                  <DocumentTree
                    rootDocUrl={rootDocUrl}
                    selected={route.page === "document" ? route.url : undefined}
                    onSelect={(url) => navigate({ page: "document", url })}
                    onDeleteSelected={() => navigate({ page: "home" })}
                    peers={peers}
                    renaming={renaming}
                    onRenamingChange={setRenaming}
                  />
                </Suspense>
              </DocumentBoundary>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            {connectionStatus === "offline" && <OfflineBanner />}
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
            {route.page === "document" && (
              <Fragment key={route.url}>
                <NoteTitle url={route.url} />
                <NotePeers url={route.url} />
              </Fragment>
            )}
            {route.page === "settings" && <h2 className="px-2.5 text-sm font-medium">Settings</h2>}
          </header>
          <div className="flex min-h-0 flex-1 flex-col">
            <MainPane route={route} logoutUrl={logoutUrl} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}

function MainPane({ route, logoutUrl }: { route: Route; logoutUrl: string | null }) {
  if (route.page === "settings") return <SettingsPage logoutUrl={logoutUrl} />;
  if (route.page === "home") {
    return (
      <StatusMessage icon={<NotebookPenIcon />}>
        Select a document, or create a new one.
      </StatusMessage>
    );
  }
  return (
    <DocumentBoundary
      key={route.url}
      url={route.url}
      fallback={
        <StatusMessage pending>Couldn’t load document. Waiting for the server…</StatusMessage>
      }
    >
      <Suspense fallback={<StatusMessage pending>Loading document…</StatusMessage>}>
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
