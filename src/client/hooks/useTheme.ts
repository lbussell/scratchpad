import { useSyncExternalStore } from "react";
import { getTheme, setTheme, subscribeToTheme, type Theme } from "../theme.ts";

export function useTheme(): [Theme, (theme: Theme) => void] {
  return [useSyncExternalStore(subscribeToTheme, getTheme), setTheme];
}
