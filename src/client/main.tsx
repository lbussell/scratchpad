import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { resaveSubscription } from "./push.ts";
import { createRepo } from "./repo.ts";
import { loadStartupSession } from "./session.ts";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");

// Lets the installed app open offline (sw.ts). Not in development, where it would serve stale
// code instead of Vite's.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js");
  // A notification tapped while the app was open: go to what it's about.
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent<unknown>) => {
    const { data } = event;
    if (typeof data !== "object" || data === null) return;
    if (!("type" in data) || data.type !== "open") return;
    if (!("url" in data) || typeof data.url !== "string") return;
    const url = new URL(data.url, location.href);
    if (url.origin === location.origin) location.assign(url);
  });
}

const { repo, serverConnection } = createRepo();
const { session, isSaved } = await loadStartupSession();
// Keeps the server's record of this device current, for reminders. Without a connection, there's
// no server to tell.
if (!isSaved) {
  resaveSubscription().catch((error: unknown) => {
    console.warn("Couldn’t update this device’s notifications:", error);
  });
}

createRoot(rootElement).render(
  <StrictMode>
    <RepoContext.Provider value={repo}>
      <App session={session} isSavedSession={isSaved} serverConnection={serverConnection} />
    </RepoContext.Provider>
  </StrictMode>,
);
