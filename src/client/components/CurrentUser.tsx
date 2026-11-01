import { LogOutIcon } from "lucide-react";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "../hooks/useCurrentUser.ts";
import { initials } from "../initials.ts";
import type { ConnectionStatus } from "../serverConnection.ts";

const statusLabels: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  online: "Online",
  offline: "Offline",
};

interface CurrentUserProps {
  status: ConnectionStatus;
  /** POST here to log out, if the deployment supports it. */
  logoutUrl: string | null;
}

/** Who's signed in, with a green badge while connected to the sync server. */
export function CurrentUser({ status, logoutUrl }: CurrentUserProps) {
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
      {logoutUrl !== null && (
        <form method="post" action={logoutUrl}>
          <Button type="submit" variant="ghost" size="icon-sm" aria-label="Log out">
            <LogOutIcon />
          </Button>
        </form>
      )}
      {/* The badge and the offline banner show the status visually; this announces it. */}
      <output aria-label="Connection" className="sr-only">
        {statusLabels[status]}
      </output>
    </div>
  );
}
