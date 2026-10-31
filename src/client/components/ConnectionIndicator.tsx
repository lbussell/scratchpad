import type { ConnectionStatus } from "../serverConnection.ts";

const labels: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  online: "Online",
  offline: "Offline",
};

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  return (
    <output className="connection">
      <p className="connection-status" data-status={status}>
        {labels[status]}
      </p>
      {status === "offline" && (
        <p className="connection-hint">Changes are saved here and will sync when you reconnect.</p>
      )}
    </output>
  );
}
