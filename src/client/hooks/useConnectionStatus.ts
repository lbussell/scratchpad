import { useSyncExternalStore } from "react";
import type { ConnectionStatus, ServerConnection } from "../serverConnection.ts";

export function useConnectionStatus(connection: ServerConnection): ConnectionStatus {
  return useSyncExternalStore(connection.subscribe, connection.getStatus);
}
