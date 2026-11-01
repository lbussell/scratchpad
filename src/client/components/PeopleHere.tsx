import { PeerAvatar, PeerAvatarGroup } from "@/components/ui/peer";
import { initials } from "../initials.ts";
import type { WorkspacePeer } from "../presence.ts";

const names = new Intl.ListFormat(undefined, { type: "conjunction" });

/** Avatars for who else has a document open, and their names for screen readers. */
export function PeopleHere({ peers }: { peers: readonly WorkspacePeer[] }) {
  if (peers.length === 0) return null;
  return (
    <>
      <PeerAvatarGroup>
        {peers.map(({ peerId, user }) => (
          <PeerAvatar key={peerId} hue={user.hue} aria-hidden="true">
            {initials(user.name)}
          </PeerAvatar>
        ))}
      </PeerAvatarGroup>
      <span className="sr-only">
        {names.format(peers.map(({ user }) => user.name))} {peers.length === 1 ? "is" : "are"} here
      </span>
    </>
  );
}
