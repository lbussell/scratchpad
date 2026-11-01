/** Up to two initials for an avatar, e.g. "AL" for Ada Lovelace. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
