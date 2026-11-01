import {
  type AutomergeUrl,
  type Cursor,
  type DocHandle,
  isValidAutomergeUrl,
  type PeerId,
  Presence,
} from "@automerge/automerge-repo";
import type { EditorView } from "@codemirror/view";
import { useEffect, useSyncExternalStore } from "react";
import type { NoteDoc, RootDoc, UserProfile } from "../shared/schema.ts";
import { useCurrentUser } from "./hooks/useCurrentUser.ts";

/** What others need to know about someone to show them. */
export type PresenceUser = Pick<UserProfile, "id" | "name" | "hue">;

/** Someone who has the same document open, in another tab or browser. */
export interface Peer<State> {
  peerId: PeerId;
  state: State;
}

/**
 * Ephemeral state shared with everyone who has a document open, over Automerge's presence
 * messages (relayed by the server, never stored). Components retain it while they need it; it
 * runs while anything does, and says goodbye when the page goes away so others don't have to
 * wait for us to time out.
 */
class SharedPresence<State extends { user: PresenceUser }> {
  readonly #presence: Presence<State>;
  readonly #isState: (value: unknown) => value is State;
  readonly #listeners = new Set<() => void>();
  #state: State;
  #retainers = 0;

  constructor(
    handle: DocHandle<unknown>,
    state: State,
    isState: (value: unknown) => value is State,
  ) {
    this.#presence = new Presence<State>({ handle });
    this.#state = state;
    this.#isState = isState;
    this.#presence.on("update", ({ peerId, channel }) => {
      this.onPeerActivity(peerId, channel);
      this.changed();
    });
    this.#presence.on("snapshot", ({ peerId }) => {
      this.onPeerActivity(peerId, null);
      this.changed();
    });
    this.#presence.on("goodbye", ({ peerId }) => {
      this.onPeerGone([peerId]);
      this.changed();
    });
    this.#presence.on("pruning", ({ pruned }) => {
      this.onPeerGone(pruned);
      this.changed();
    });
  }

  get state(): State {
    return this.#state;
  }

  /** Starts sharing, if nothing else has; call the returned function when done. */
  retain(): () => void {
    this.#retainers++;
    if (this.#retainers === 1) {
      this.#start();
      window.addEventListener("pagehide", this.#stop);
      window.addEventListener("pageshow", this.#start);
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#retainers--;
      if (this.#retainers > 0) return;
      window.removeEventListener("pagehide", this.#stop);
      window.removeEventListener("pageshow", this.#start);
      this.#stop();
    };
  }

  /** Calls `listener` when peers' state changes. For useSyncExternalStore. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Everyone else with the document open, including our own other tabs. */
  peers(): Peer<State>[] {
    if (!this.#presence.running) return [];
    const peers: Peer<State>[] = [];
    for (const { peerId, value } of Object.values(this.#presence.getPeerStates().value)) {
      // Peers' state comes off the network, so check it.
      if (this.#isState(value)) peers.push({ peerId, state: value });
    }
    return peers;
  }

  /** Changes our state, and tells everyone if we're sharing. */
  broadcast<Channel extends keyof State & string>(channel: Channel, value: State[Channel]): void {
    this.#state = { ...this.#state, [channel]: value };
    if (this.#presence.running) this.#presence.broadcast(channel, value);
  }

  setUser(user: PresenceUser): void {
    const current = this.#state.user;
    if (user.id === current.id && user.name === current.name && user.hue === current.hue) return;
    this.broadcast("user", user);
  }

  /** A peer sent new state; `channel` is null for a full snapshot. */
  protected onPeerActivity(_peerId: PeerId, _channel: string | null): void {}

  protected onPeerGone(_peerIds: PeerId[]): void {}

  protected onStart(): void {}

  protected onStop(): void {}

  /** Peers' state changed: tell subscribers. */
  protected changed(): void {
    for (const listener of this.#listeners) listener();
  }

  #start = () => {
    if (this.#presence.running) return;
    this.#presence.start({ initialState: this.#state });
    this.onStart();
  };

  #stop = () => {
    if (!this.#presence.running) return;
    this.#presence.stop();
    this.onStop();
    this.changed();
  };
}

// Notes ------------------------------------------------------------------------------------------

/** What each person shares about themselves in a note. */
export type NoteState = {
  user: PresenceUser;
  /**
   * Automerge cursors rather than indexes, so they point at the same characters on every peer
   * even while edits are in flight. Null while the editor doesn't have focus.
   */
  selection: { anchor: Cursor; head: Cursor } | null;
  /**
   * The character under their mouse, or null when it isn't over the text. Missing from clients
   * from before mouse and click sharing, like clicks.
   */
  pointer?: Cursor | null;
  /** How many times they've clicked or tapped, so others can react to each one. */
  clicks?: number;
};

/** Someone else in the note, as the eyes beside its title show them. */
export interface NotePeer {
  peerId: PeerId;
  user: PresenceUser;
  /** What they're looking at: their mouse, or failing that their caret. */
  target: Cursor | null;
  clicks: number;
  /** True when they haven't done anything for a while. */
  asleep: boolean;
}

/** How long someone can do nothing before their eyes close. */
export const SLEEP_AFTER_MS = 30_000;
/** Mouse moves are shared at most this often. */
const POINTER_INTERVAL_MS = 80;

export class NotePresence extends SharedPresence<NoteState> {
  /** The editor showing this note, so positions in the text can be found on screen. */
  #view: EditorView | null = null;
  /** When each peer last did something, by our clock. */
  readonly #activeAt = new Map<PeerId, number>();
  /** Whether each peer last moved their mouse or their caret. */
  readonly #looksAt = new Map<PeerId, "pointer" | "selection">();
  #others: readonly NotePeer[] = [];
  #sleepTimer: ReturnType<typeof setTimeout> | undefined;
  #pendingPointer: Cursor | null = null;
  #pointerTimer: ReturnType<typeof setTimeout> | undefined;

  readonly handle: DocHandle<NoteDoc>;

  constructor(handle: DocHandle<NoteDoc>, user: PresenceUser) {
    super(handle, { user, selection: null, pointer: null, clicks: 0 }, isNoteState);
    this.handle = handle;
  }

  get view(): EditorView | null {
    return this.#view;
  }

  setView(view: EditorView | null): void {
    this.#view = view;
    this.changed();
  }

  /** Other people in the note, one entry each. For useSyncExternalStore. */
  getOthers = (): readonly NotePeer[] => this.#others;

  setSelection(selection: NoteState["selection"]): void {
    if (JSON.stringify(selection) === JSON.stringify(this.state.selection)) return;
    this.broadcast("selection", selection);
  }

  /** Shares the mouse position: right away, then at most every POINTER_INTERVAL_MS. */
  setPointer(pointer: Cursor | null): void {
    this.#pendingPointer = pointer;
    if (this.#pointerTimer === undefined) this.#flushPointer();
  }

  protected override onPeerActivity(peerId: PeerId, channel: string | null): void {
    if (channel === null) {
      // Snapshots are resent whenever anyone joins, so only a peer's first one is news.
      if (!this.#activeAt.has(peerId)) this.#activeAt.set(peerId, performance.now());
      return;
    }
    if (channel === "user") return;
    this.#activeAt.set(peerId, performance.now());
    if (channel === "pointer" || channel === "selection") this.#looksAt.set(peerId, channel);
  }

  protected override onPeerGone(peerIds: PeerId[]): void {
    for (const peerId of peerIds) {
      this.#activeAt.delete(peerId);
      this.#looksAt.delete(peerId);
    }
  }

  protected override onStart(): void {
    window.addEventListener("pointerdown", this.#onPointerDown);
  }

  protected override onStop(): void {
    window.removeEventListener("pointerdown", this.#onPointerDown);
    clearTimeout(this.#pointerTimer);
    this.#pointerTimer = undefined;
  }

  protected override changed(): void {
    this.#others = this.#findOthers();
    this.#scheduleSleep();
    super.changed();
  }

  #findOthers(): NotePeer[] {
    const now = performance.now();
    // One entry per person: if they have the note open in several tabs, the latest active.
    const byUser = new Map<string, NotePeer>();
    for (const { peerId, state } of this.peers()) {
      if (state.user.id === this.state.user.id) continue;
      const activeAt = this.#activeAt.get(peerId) ?? now;
      const previous = byUser.get(state.user.id);
      if (previous && (this.#activeAt.get(previous.peerId) ?? now) >= activeAt) continue;
      const pointer = state.pointer ?? null;
      const target =
        (this.#looksAt.get(peerId) === "selection" ? null : pointer) ??
        state.selection?.head ??
        pointer;
      byUser.set(state.user.id, {
        peerId,
        user: state.user,
        target,
        clicks: state.clicks ?? 0,
        asleep: now - activeAt >= SLEEP_AFTER_MS,
      });
    }
    return [...byUser.values()].toSorted((a, b) => a.user.name.localeCompare(b.user.name));
  }

  /** Wakes up when the next person should fall asleep, to show it. */
  #scheduleSleep(): void {
    clearTimeout(this.#sleepTimer);
    this.#sleepTimer = undefined;
    const awake = this.#others.filter((peer) => !peer.asleep);
    if (awake.length === 0) return;
    const next = Math.min(...awake.map((peer) => this.#activeAt.get(peer.peerId) ?? Infinity));
    if (!Number.isFinite(next)) return;
    const delay = next + SLEEP_AFTER_MS - performance.now();
    this.#sleepTimer = setTimeout(() => this.changed(), Math.max(0, delay) + 50);
  }

  #flushPointer = () => {
    this.#pointerTimer = undefined;
    if (this.#pendingPointer === (this.state.pointer ?? null)) return;
    this.broadcast("pointer", this.#pendingPointer);
    this.#pointerTimer = setTimeout(this.#flushPointer, POINTER_INTERVAL_MS);
  };

  #onPointerDown = () => {
    this.broadcast("clicks", (this.state.clicks ?? 0) + 1);
  };
}

function isNoteState(value: unknown): value is NoteState {
  if (typeof value !== "object" || value === null) return false;
  if (!("user" in value) || !isPresenceUser(value.user) || !("selection" in value)) return false;
  const { selection } = value;
  const isSelection =
    selection === null ||
    (typeof selection === "object" &&
      "anchor" in selection &&
      typeof selection.anchor === "string" &&
      "head" in selection &&
      typeof selection.head === "string");
  // Clients from before mouse and click sharing don't send those.
  const pointer = "pointer" in value ? value.pointer : null;
  const clicks = "clicks" in value ? value.clicks : 0;
  return (
    isSelection &&
    (pointer === null || typeof pointer === "string") &&
    typeof clicks === "number" &&
    Number.isFinite(clicks)
  );
}

const notePresences = new WeakMap<DocHandle<NoteDoc>, NotePresence>();

/** Shares presence in a note while the calling component is mounted. */
export function useNotePresence(handle: DocHandle<NoteDoc>): NotePresence {
  const { user } = useCurrentUser();
  const presence = cachedPresence(notePresences, handle, () => new NotePresence(handle, user));
  const { id, name, hue } = user;
  // Before retaining, so sharing starts with the current user.
  useEffect(() => presence.setUser({ id, name, hue }), [presence, id, name, hue]);
  useEffect(() => presence.retain(), [presence]);
  return presence;
}

// Where everyone is ------------------------------------------------------------------------------

/** What each person shares about themselves in the workspace. */
type WorkspaceState = {
  user: PresenceUser;
  /** The document they have open, if any. */
  document: AutomergeUrl | null;
};

export interface WorkspacePeer {
  peerId: PeerId;
  user: PresenceUser;
}

class WorkspacePresence extends SharedPresence<WorkspaceState> {
  #documents: ReadonlyMap<AutomergeUrl, readonly WorkspacePeer[]> = new Map();

  constructor(handle: DocHandle<RootDoc>, user: PresenceUser) {
    super(handle, { user, document: null }, isWorkspaceState);
  }

  /** Who else has each document open. For useSyncExternalStore. */
  getDocuments = (): ReadonlyMap<AutomergeUrl, readonly WorkspacePeer[]> => this.#documents;

  protected override changed(): void {
    const documents = new Map<AutomergeUrl, WorkspacePeer[]>();
    for (const { peerId, state } of this.peers()) {
      if (state.document === null || state.user.id === this.state.user.id) continue;
      const here = documents.get(state.document) ?? [];
      // Once per person, even with the document open in several tabs.
      if (!here.some((peer) => peer.user.id === state.user.id)) {
        here.push({ peerId, user: state.user });
      }
      documents.set(state.document, here);
    }
    this.#documents = documents;
    super.changed();
  }
}

function isWorkspaceState(value: unknown): value is WorkspaceState {
  return (
    typeof value === "object" &&
    value !== null &&
    "user" in value &&
    isPresenceUser(value.user) &&
    "document" in value &&
    (value.document === null || isValidAutomergeUrl(value.document))
  );
}

const workspacePresences = new WeakMap<DocHandle<RootDoc>, WorkspacePresence>();
const noPeers: ReadonlyMap<AutomergeUrl, readonly WorkspacePeer[]> = new Map();
const subscribeToNothing = () => () => {};

/**
 * Tells everyone which document we have open, and returns who else has each document open. The handle
 * is undefined while the root document loads.
 */
export function useWorkspacePresence(
  handle: DocHandle<RootDoc> | undefined,
  document: AutomergeUrl | null,
): ReadonlyMap<AutomergeUrl, readonly WorkspacePeer[]> {
  const { user } = useCurrentUser();
  const presence = handle
    ? cachedPresence(workspacePresences, handle, () => new WorkspacePresence(handle, user))
    : undefined;
  const { id, name, hue } = user;

  useEffect(() => presence?.setUser({ id, name, hue }), [presence, id, name, hue]);
  useEffect(() => {
    if (presence && presence.state.document !== document) presence.broadcast("document", document);
  }, [presence, document]);
  useEffect(() => presence?.retain(), [presence]);

  return useSyncExternalStore(
    presence?.subscribe ?? subscribeToNothing,
    presence?.getDocuments ?? (() => noPeers),
  );
}

// Helpers ----------------------------------------------------------------------------------------

function isPresenceUser(value: unknown): value is PresenceUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "hue" in value &&
    (value.hue === null || (typeof value.hue === "number" && Number.isFinite(value.hue)))
  );
}

/** One presence per document, however many components use it. */
function cachedPresence<Handle extends object, P>(
  cache: WeakMap<Handle, P>,
  handle: Handle,
  create: () => P,
): P {
  let presence = cache.get(handle);
  if (!presence) {
    presence = create();
    cache.set(handle, presence);
  }
  return presence;
}
