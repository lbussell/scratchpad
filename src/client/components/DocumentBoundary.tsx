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
    const controller = new AbortController();
    const { handle } = repo.findWithProgress(url);
    const retryWhenReady = async () => {
      await handle.whenReady(["ready"], { signal: controller.signal });
      onReady();
    };
    retryWhenReady().catch(() => {
      // Aborted on unmount.
    });
    return () => controller.abort();
  }, [repo, url, onReady]);

  return children;
}
