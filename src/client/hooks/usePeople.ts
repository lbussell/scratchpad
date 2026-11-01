import { useEffect, useMemo, useSyncExternalStore } from "react";
import { isPerson, type Person, USERS_API_PATH } from "../../shared/schema.ts";
import { useCurrentUser } from "./useCurrentUser.ts";

// The last list from the server, so to-dos show who they're assigned to offline.
const STORAGE_KEY = "people";

let people: readonly Person[] = load();
const listeners = new Set<() => void>();
let fetching = false;

/**
 * Everyone who has signed in, by name, for assigning to-dos. Fetched afresh whenever a component
 * starts using it, and saved on this device for when the server can't be reached.
 */
export function usePeople(): readonly Person[] {
  useEffect(refresh, []);
  const list = useSyncExternalStore(subscribe, () => people);
  const { user } = useCurrentUser();
  const { id, name, hue } = user;
  // Always includes us, with our latest profile.
  return useMemo(
    () =>
      [{ id, name, hue }, ...list.filter((person) => person.id !== id)].toSorted((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [list, id, name, hue],
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function refresh(): void {
  if (fetching) return;
  fetching = true;
  void fetchPeople().finally(() => {
    fetching = false;
  });
}

async function fetchPeople(): Promise<void> {
  try {
    const response = await fetch(USERS_API_PATH);
    const body: unknown = response.ok ? await response.json() : undefined;
    if (!Array.isArray(body)) return;
    people = body.filter(isPerson);
  } catch {
    // Offline: keep the saved list.
    return;
  }
  save(people);
  for (const listener of listeners) listener();
}

function load(): readonly Person[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isPerson) : [];
  } catch {
    return [];
  }
}

function save(list: readonly Person[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage can be full or disabled; only offline starts miss out.
  }
}
