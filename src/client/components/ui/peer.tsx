import * as React from "react";
import { cn } from "cn";

interface PeerProps {
  /** The person's color: a hue, or null for Neutral (gray). Sets bg-peer's color. */
  hue: number | null;
}

/** A small round avatar in someone's color, usually with their initials. */
function PeerAvatar({
  hue,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "style"> & PeerProps) {
  return (
    <span
      data-slot="peer-avatar"
      style={{ "--peer-hue": hue ?? 0, "--peer-tint": hue === null ? 0 : 1 }}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full bg-peer text-[10px] leading-none font-semibold text-presence-foreground ring-2 ring-background select-none",
        className,
      )}
      {...props}
    />
  );
}

/** Overlapping avatars. Also reserves their space when empty, with one child per avatar. */
function PeerAvatarGroup({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="peer-avatar-group"
      className={cn("flex shrink-0 -space-x-1.5 *:size-5 *:shrink-0", className)}
      {...props}
    />
  );
}

interface PeerEyesProps extends Omit<React.ComponentProps<"span">, "style">, PeerProps {
  /** Shown instead of the eyes on hover. */
  name: string;
  /** Shown instead of the eyes, if given: a plain avatar that still shows the name on hover. */
  initials?: string | undefined;
  /** Where the eyes look, from -1 to 1 on each axis: left to right, and up to down. */
  look: { x: number; y: number };
  /** Closes the eyes, low down, with a "z" drifting up. */
  asleep?: boolean;
  /** The eyes blink each time this changes. */
  blinks?: number;
}

/**
 * A little character in someone's color whose eyes look around. Hovering it turns it into their
 * name.
 */
function PeerEyes({
  hue,
  name,
  initials,
  look,
  asleep = false,
  blinks = 0,
  className,
  ...props
}: PeerEyesProps) {
  const eyesRef = React.useRef<HTMLSpanElement>(null);
  const shownBlinks = React.useRef(blinks);

  React.useEffect(() => {
    if (blinks === shownBlinks.current) return;
    shownBlinks.current = blinks;
    if (asleep) return;
    for (const eye of eyesRef.current?.children ?? []) {
      eye.animate([{ scale: "1 1" }, { scale: "1 0.1" }, { scale: "1 1" }], {
        duration: 180,
        easing: "ease-in-out",
      });
    }
  }, [blinks, asleep]);

  // The eyes move within the character. Asleep, they settle near the bottom.
  const x = asleep ? 0 : look.x * 5;
  const y = asleep ? 5 : look.y * 3;
  const eye = cn(
    "h-2.25 w-1 rounded-full bg-presence-eye transition-[scale] duration-300",
    asleep && "scale-y-20",
  );

  return (
    <span
      data-slot="peer-eyes"
      data-face={initials === undefined ? "eyes" : "initials"}
      style={{
        "--peer-hue": hue ?? 0,
        "--peer-tint": hue === null ? 0 : 1,
        "--eyes-x": `${x.toFixed(2)}px`,
        "--eyes-y": `${y.toFixed(2)}px`,
      }}
      className={cn(
        "group/peer relative inline-flex h-6 min-w-9 shrink-0 items-center justify-center rounded-full bg-peer select-none data-[face=initials]:min-w-6",
        className,
      )}
      {...props}
    >
      <span className="absolute inset-0 flex items-center justify-center transition-opacity duration-150 group-hover/peer:opacity-0">
        {initials === undefined ? (
          <span
            ref={eyesRef}
            className="flex translate-x-(--eyes-x) translate-y-(--eyes-y) gap-1 transition-[translate] duration-200 ease-out motion-reduce:transition-none"
          >
            <span className={eye} />
            <span className={eye} />
          </span>
        ) : (
          // A pseudo-element, like the name below.
          <span
            data-initials={initials}
            className="text-[11px] leading-none font-semibold text-presence-foreground before:content-[attr(data-initials)]"
          />
        )}
      </span>
      {/* Grows from nothing to the name's width, widening the character. A pseudo-element, so
          the name isn't part of the text: the character is decoration, labelled elsewhere. */}
      <span className="grid grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity] duration-200 ease-out group-hover/peer:grid-cols-[1fr] group-hover/peer:opacity-100 motion-reduce:transition-none">
        <span className="min-w-0 overflow-hidden">
          <span
            data-name={name}
            className="block px-2 text-xs leading-none font-medium whitespace-nowrap text-presence-foreground before:content-[attr(data-name)]"
          />
        </span>
      </span>
      {/* Also a pseudo-element. */}
      {asleep && (
        <span
          aria-hidden="true"
          className="absolute -top-2.5 -right-1.5 animate-doze text-[10px] leading-none font-semibold text-muted-foreground transition-opacity group-hover/peer:opacity-0 before:content-['z'] motion-reduce:animate-none"
        />
      )}
    </span>
  );
}

export { PeerAvatar, PeerAvatarGroup, PeerEyes };
