import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { useCurrentUser } from "../hooks/useCurrentUser.ts";
import { initials } from "../initials.ts";
import type { ConnectionStatus } from "../serverConnection.ts";

const statusLabels: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  online: "Online",
  offline: "Offline",
};

/** Who's signed in, with a green badge while connected to the sync server. Log out is in settings. */
export function CurrentUser({ status }: { status: ConnectionStatus }) {
  const { user } = useCurrentUser();

  return (
    <div className="flex items-center gap-2 p-2 text-left text-sm">
      <Avatar>
        <AvatarFallback>{initials(user.name)}</AvatarFallback>
        {status === "online" && <AvatarBadge variant="success" />}
      </Avatar>
      <div className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      </div>
      {/* The badge and the offline banner show the status visually; this announces it. */}
      <output aria-label="Connection" className="sr-only">
        {statusLabels[status]}
      </output>
    </div>
  );
}
