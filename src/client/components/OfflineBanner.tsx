import { WifiOffIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function OfflineBanner() {
  return (
    <Alert variant="warning" size="sm">
      <WifiOffIcon />
      <AlertTitle>You’re offline</AlertTitle>
      <AlertDescription>
        Changes are saved on this device and will sync when you reconnect.
      </AlertDescription>
    </Alert>
  );
}
