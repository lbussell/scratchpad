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
  /** Where the eyes look, from -1 to 1 on each axis: left to right, and up to down. */
  look: { x: number; y: number };
  /** Closes the eyes, with a "z" drifting up. */
  asleep?: boolean;
  /** The eyes blink each time this changes. */
  blinks?: number;
}

/** A little character in someone's color whose eyes look around. */
function PeerEyes({ hue, look, asleep = false, blinks = 0, className, ...props }: PeerEyesProps) {
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

  // Asleep, the eyes settle a little low.
  const x = asleep ? 0 : look.x * 4;
  const y = asleep ? 1.5 : look.y * 4;
  const eye = cn(
    "h-2.5 w-1.5 rounded-full bg-presence-eye transition-[scale] duration-300",
    asleep && "scale-y-20",
  );

  return (
    <span
      data-slot="peer-eyes"
      style={{
        "--peer-hue": hue ?? 0,
        "--peer-tint": hue === null ? 0 : 1,
        "--eyes-x": `${x.toFixed(2)}px`,
        "--eyes-y": `${y.toFixed(2)}px`,
      }}
      className={cn(
        "relative flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-peer select-none",
        className,
      )}
      {...props}
    >
      <span
        ref={eyesRef}
        aria-hidden="true"
        className="flex translate-x-(--eyes-x) translate-y-(--eyes-y) gap-1 transition-[translate] duration-200 ease-out motion-reduce:transition-none"
      >
        <span className={eye} />
        <span className={eye} />
      </span>
      {/* A pseudo-element, so the "z" isn't part of the text. */}
      {asleep && (
        <span
          aria-hidden="true"
          className="absolute -top-2.5 -right-1.5 animate-doze text-[10px] leading-none font-semibold text-muted-foreground before:content-['z'] motion-reduce:animate-none"
        />
      )}
    </span>
  );
}

export { PeerAvatar, PeerAvatarGroup, PeerEyes };
