import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useDocHandle } from "@automerge/automerge-repo-react-hooks";
import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PeerEyes } from "@/components/ui/peer";
import type { NoteDoc } from "../../shared/schema.ts";
import { useCurrentUser } from "../hooks/useCurrentUser.ts";
import { initials } from "../initials.ts";
import { type NotePeer, type NotePresence, useNotePresence } from "../presence.ts";
import { resolveCursor } from "../remoteCursors.ts";

interface Look {
  x: number;
  y: number;
}

/** Looking ahead, at nothing in particular. */
const AHEAD: Look = { x: 0, y: 0 };
/** How far away, in pixels, something has to be for the eyes to look all the way to that side. */
const REACH = { x: 300, y: 200 };

/**
 * A little pair of eyes for everyone else in the note. They look at that person's mouse, or
 * their caret, blink when they click, and close when they've been idle for a while. Or, if the
 * user prefers (see the peerStyle setting), their initials.
 */
export function NotePeers({ url }: { url: AutomergeUrl }) {
  // Not suspending: the editor below handles loading and errors for the note.
  const handle = useDocHandle<NoteDoc>(url);
  if (!handle) return null;
  return <PeerEyesList handle={handle} />;
}

function PeerEyesList({ handle }: { handle: DocHandle<NoteDoc> }) {
  const presence = useNotePresence(handle);
  const peers = useSyncExternalStore(presence.subscribe, presence.getOthers);
  const looks = useLooks(presence);
  const showInitials = useCurrentUser().user.peerStyle === "initials";

  if (peers.length === 0) return null;
  return (
    <ul aria-label="People in this note" className="flex shrink-0 items-center gap-1.5 px-1">
      {peers.map((peer) => {
        const label = peer.asleep ? `${peer.user.name} (idle)` : peer.user.name;
        return (
          <li key={peer.user.id} className="flex">
            <PeerEyes
              data-user={peer.user.id}
              aria-hidden="true"
              hue={peer.user.hue}
              name={peer.user.name}
              initials={showInitials ? initials(peer.user.name) : undefined}
              look={looks.get(peer.user.id) ?? AHEAD}
              asleep={peer.asleep}
              blinks={peer.clicks}
            />
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Where each person's eyes should look: from the eyes towards what they're looking at, as it
 * appears in our editor. Recomputed whenever that might have moved.
 */
function useLooks(presence: NotePresence): ReadonlyMap<string, Look> {
  const [looks, setLooks] = useState<ReadonlyMap<string, Look>>(new Map());
  const frame = useRef(0);

  useEffect(() => {
    const update = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        setLooks(computeLooks(presence, presence.getOthers()));
      });
    };
    update();
    const unsubscribe = presence.subscribe(update);
    // Edits, scrolling and resizing all move text around on screen.
    presence.handle.on("change", update);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      unsubscribe();
      presence.handle.off("change", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, { capture: true });
    };
  }, [presence]);

  return looks;
}

function computeLooks(presence: NotePresence, peers: readonly NotePeer[]): Map<string, Look> {
  const looks = new Map<string, Look>();
  const { view } = presence;
  if (!view) return looks;
  for (const peer of peers) {
    if (peer.target === null) continue;
    const eyes = document.querySelector(
      `[data-slot="peer-eyes"][data-user="${CSS.escape(peer.user.id)}"]`,
    );
    const position = resolveCursor(presence, ["text"], peer.target, view);
    if (!eyes || position === undefined) continue;
    const target = pointOnScreen(view, position);
    const { left, top, width, height } = eyes.getBoundingClientRect();
    looks.set(peer.user.id, {
      x: clamp((target.x - (left + width / 2)) / REACH.x),
      y: clamp((target.y - (top + height / 2)) / REACH.y),
    });
  }
  return looks;
}

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/** Where a position in the text is on screen, even if it's scrolled out of view. */
function pointOnScreen(view: EditorView, position: number): { x: number; y: number } {
  const coords = view.coordsAtPos(position);
  if (coords) return { x: coords.left, y: (coords.top + coords.bottom) / 2 };
  // CodeMirror only lays out what's in view; elsewhere, use the line's place in the document.
  const line = view.lineBlockAt(position);
  const content = view.contentDOM.getBoundingClientRect();
  return { x: content.left + content.width / 2, y: view.documentTop + line.top + line.height / 2 };
}
