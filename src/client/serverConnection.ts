import type { WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

export type ConnectionStatus = "connecting" | "online" | "offline";

export interface ServerConnection {
  subscribe: (onChange: () => void) => () => void;
  getStatus: () => ConnectionStatus;
}

/**
 * Tracks whether this client can sync with the server. The browser's offline signal counts too,
 * because a socket can stay open while the network is down (e.g. DevTools' offline mode) and
 * silently drop messages.
 */
export function watchServerConnection(adapter: WebSocketClientAdapter): ServerConnection {
  let joined = false;
  let firstAttemptSettled = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  adapter.on("peer-candidate", () => {
    joined = true;
    notify();
  });
  adapter.on("peer-disconnected", () => {
    joined = false;
    notify();
  });
  const settleFirstAttempt = async () => {
    // Resolves when the first connection succeeds, or after the adapter gives up waiting (1s).
    await adapter.whenReady();
    firstAttemptSettled = true;
    notify();
  };
  void settleFirstAttempt();
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);

  return {
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getStatus: () => {
      if (!navigator.onLine) return "offline";
      if (joined) return "online";
      return firstAttemptSettled ? "offline" : "connecting";
    },
  };
}
