import { type AutomergeUrl, isValidAutomergeUrl } from "@automerge/automerge-repo";
import { useCallback, useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getSnapshot(): AutomergeUrl | undefined {
  const hash = decodeURIComponent(location.hash.slice(1));
  return isValidAutomergeUrl(hash) ? hash : undefined;
}

/** The selected note lives in the URL hash so it survives reloads and can be shared. */
export function useSelectedNote(): [AutomergeUrl | undefined, (url: AutomergeUrl) => void] {
  const selected = useSyncExternalStore(subscribe, getSnapshot);
  const select = useCallback((url: AutomergeUrl) => {
    location.hash = url;
  }, []);
  return [selected, select];
}
