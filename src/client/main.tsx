import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { createRepo, fetchRootDocUrl } from "./repo.ts";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");

const { repo, serverConnection } = createRepo();
const rootDocUrl = await fetchRootDocUrl();

createRoot(rootElement).render(
  <StrictMode>
    <RepoContext.Provider value={repo}>
      <App rootDocUrl={rootDocUrl} serverConnection={serverConnection} />
    </RepoContext.Provider>
  </StrictMode>,
);
