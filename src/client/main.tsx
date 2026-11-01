import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { createRepo } from "./repo.ts";
import { loadStartupSession } from "./session.ts";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");

// Lets the installed app open offline (sw.ts). Not in development, where it would serve stale
// code instead of Vite's.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js");
}

const { repo, serverConnection } = createRepo();
const { session, isSaved } = await loadStartupSession();

createRoot(rootElement).render(
  <StrictMode>
    <RepoContext.Provider value={repo}>
      <App session={session} isSavedSession={isSaved} serverConnection={serverConnection} />
    </RepoContext.Provider>
  </StrictMode>,
);
