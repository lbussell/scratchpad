import { createContext, useContext } from "react";
import type { UserProfile } from "../../shared/schema.ts";

export interface CurrentUser {
  user: UserProfile;
  /** Call after the profile changes on the server. */
  setUser: (user: UserProfile) => void;
}

export const CurrentUserContext = createContext<CurrentUser | null>(null);

export function useCurrentUser(): CurrentUser {
  const currentUser = useContext(CurrentUserContext);
  if (!currentUser) throw new Error("useCurrentUser needs a CurrentUserContext provider");
  return currentUser;
}
