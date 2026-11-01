/**
 * Whether an unhandled rejection is automerge-repo giving up waiting for a document. Version 2.5.6
 * starts some of those waits without handling their failure (`void docSynchronizer.beginSync(...)`
 * in CollectionSynchronizer): when a client says it has a document, then leaves before sending
 * it, the wait times out a minute later with nothing to catch it.
 */
export function isAutomergeTimeout(reason: unknown): boolean {
  return (
    reason instanceof Error &&
    reason.name === "TimeoutError" &&
    reason.message.startsWith("withTimeout:")
  );
}

/**
 * Keeps the server running through automerge-repo's unhandled timeouts, which Node would otherwise
 * treat as fatal, taking sync down for everyone. Any other unhandled rejection still crashes the
 * process, as Node does by default.
 */
export function surviveAutomergeTimeouts(): void {
  process.on("unhandledRejection", (reason) => {
    if (isAutomergeTimeout(reason)) {
      console.warn("Gave up waiting for a document a client didn't send:", reason);
      return;
    }
    throw reason;
  });
}
