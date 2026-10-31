import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { createRepo } from "./repo.ts";
import { fetchSession } from "./session.ts";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");

const { repo, serverConnection } = createRepo();
const session = await fetchSession();

createRoot(rootElement).render(
  <StrictMode>
    <RepoContext.Provider value={repo}>
      <App session={session} serverConnection={serverConnection} />
    </RepoContext.Provider>
  </StrictMode>,
);
