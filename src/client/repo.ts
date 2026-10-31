import { isValidAutomergeUrl, Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { ROOT_DOC_API_PATH, SYNC_PATH } from "../shared/schema.ts";

function syncServerUrl(): string {
  const url = new URL(SYNC_PATH, location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}

export function createRepo(): Repo {
  return new Repo({
    network: [new WebSocketClientAdapter(syncServerUrl()), new BroadcastChannelNetworkAdapter()],
    storage: new IndexedDBStorageAdapter("scratchpad"),
  });
}

export async function fetchRootDocUrl(): Promise<AutomergeUrl> {
  const response = await fetch(ROOT_DOC_API_PATH);
  if (!response.ok) throw new Error(`Failed to fetch root document URL: ${response.status}`);
  const body: unknown = await response.json();
  const url = typeof body === "object" && body !== null && "url" in body ? body.url : undefined;
  if (typeof url !== "string" || !isValidAutomergeUrl(url)) {
    throw new Error("Server returned an invalid root document URL");
  }
  return url;
}
