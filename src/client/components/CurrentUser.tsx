import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import type { ConnectionStatus } from "../serverConnection.ts";

// Placeholders until there are accounts.
const name = "Ada Lovelace";
const email = "ada@example.com";

const statusLabels: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  online: "Online",
  offline: "Offline",
};

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Who's signed in, with a green badge while connected to the sync server. */
export function CurrentUser({ status }: { status: ConnectionStatus }) {
  return (
    <div className="flex items-center gap-2 p-2 text-left text-sm">
      <Avatar>
        <AvatarFallback>{initials(name)}</AvatarFallback>
        {status === "online" && <AvatarBadge variant="success" />}
      </Avatar>
      <div className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{email}</span>
      </div>
      {/* The badge and the offline banner show the status visually; this announces it. */}
      <output aria-label="Connection" className="sr-only">
        {statusLabels[status]}
      </output>
    </div>
  );
}
