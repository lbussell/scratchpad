import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { type ReactNode, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface DocumentBoundaryProps {
  url: AutomergeUrl;
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Catches errors from loading the document at `url`. A document that's unavailable now (say,
 * we're offline and have never synced it) can still arrive later, so retry once it does.
 */
export function DocumentBoundary({ url, fallback, children }: DocumentBoundaryProps) {
  return (
    <ErrorBoundary
      resetKeys={[url]}
      fallbackRender={({ resetErrorBoundary }) => (
        <RetryWhenReady url={url} onReady={resetErrorBoundary}>
          {fallback}
        </RetryWhenReady>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

interface RetryWhenReadyProps {
  url: AutomergeUrl;
  onReady: () => void;
  children: ReactNode;
}

function RetryWhenReady({ url, onReady, children }: RetryWhenReadyProps) {
  const repo = useRepo();

  useEffect(() => {
    // Watches the load rather than awaiting it, since awaiting gives up while it's unavailable.
    const progress = repo.findWithProgress(url);
    if (progress.peek().state === "ready") {
      onReady();
      return undefined;
    }
    return progress.subscribe(({ state }) => {
      if (state === "ready") onReady();
    });
  }, [repo, url, onReady]);

  return children;
}
