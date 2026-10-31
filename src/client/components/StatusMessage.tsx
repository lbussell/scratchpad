import type { ReactNode } from "react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

interface StatusMessageProps {
  children: ReactNode;
  icon?: ReactNode;
  pending?: boolean;
}

/** A centered placeholder for an area that's loading, waiting, or empty. */
export function StatusMessage({ children, icon, pending = false }: StatusMessageProps) {
  const media = pending ? <Spinner /> : icon;
  return (
    <Empty>
      <EmptyHeader>
        {media && <EmptyMedia variant="icon">{media}</EmptyMedia>}
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
