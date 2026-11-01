import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

/**
 * Shown instead of the app when its code and the root document are different versions, so it
 * doesn't read or write a shape it doesn't understand.
 */
export function SchemaMismatch({ status }: { status: "newer" | "older" }) {
  if (status === "older") {
    return (
      <Empty className="h-svh">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyDescription>Waiting for the server to update your documents…</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Empty className="h-svh">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RefreshCwIcon />
        </EmptyMedia>
        <EmptyTitle>Scratchpad has been updated</EmptyTitle>
        <EmptyDescription>Reload to keep working.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => location.reload()}>Reload</Button>
      </EmptyContent>
    </Empty>
  );
}
