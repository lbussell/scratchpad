import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus } from "../serverConnection.ts";

const labels: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  online: "Online",
  offline: "Offline",
};

const dotColors: Record<ConnectionStatus, string> = {
  connecting: "bg-warning",
  online: "bg-success",
  offline: "bg-destructive",
};

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  return (
    <output aria-label="Connection" className="flex min-w-0 flex-col items-start gap-1">
      <Badge variant="outline">
        <span aria-hidden className={cn("size-2 rounded-full", dotColors[status])} />
        {labels[status]}
      </Badge>
      {status === "offline" && (
        <p className="px-1 text-xs text-muted-foreground">
          Changes are saved here and will sync when you reconnect.
        </p>
      )}
    </output>
  );
}
