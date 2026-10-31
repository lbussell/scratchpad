import { Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { SYNC_PATH } from "../shared/schema.ts";
import { type ServerConnection, watchServerConnection } from "./serverConnection.ts";

function syncServerUrl(): string {
  const url = new URL(SYNC_PATH, location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}

export function createRepo(): { repo: Repo; serverConnection: ServerConnection } {
  const serverAdapter = new WebSocketClientAdapter(syncServerUrl());
  const repo = new Repo({
    network: [serverAdapter, new BroadcastChannelNetworkAdapter()],
    storage: new IndexedDBStorageAdapter("scratchpad"),
  });
  return { repo, serverConnection: watchServerConnection(serverAdapter) };
}
