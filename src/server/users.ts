import path from "node:path";
import {
  DEFAULT_REMINDER_TIME,
  HUES,
  isPeerStyle,
  isTimeOfDay,
  MAX_NAME_LENGTH,
  type Person,
  type UserProfile,
} from "../shared/schema.ts";
import type { Identity } from "./auth.ts";
import { JsonFileWriter, readJsonFile } from "./files.ts";

type StoredUser = Omit<UserProfile, "id">;

/**
 * User profiles, kept in a JSON file. Profiles live on the server rather than in a shared
 * Automerge document so that each user can only change their own.
 */
export class UserStore {
  readonly #file: JsonFileWriter;
  readonly #users: Map<string, StoredUser>;

  private constructor(file: string, users: Map<string, StoredUser>) {
    this.#file = new JsonFileWriter(file);
    this.#users = users;
  }

  static async open(dataDir: string): Promise<UserStore> {
    const file = path.join(dataDir, "users.json");
    const users = new Map<string, StoredUser>();
    const parsed = await readJsonFile(file);
    if (typeof parsed === "object" && parsed !== null) {
      for (const [id, value] of Object.entries(parsed)) {
        const user = parseStoredUser(value);
        if (user) users.set(id, user);
      }
    }
    return new UserStore(file, users);
  }

  /** The user's profile, creating it the first time we see them. */
  async ensure(identity: Identity): Promise<UserProfile> {
    const existing = this.#users.get(identity.id);
    if (existing?.email === identity.email) return { id: identity.id, ...existing };

    const hues = [...this.#users.values()].map((user) => user.hue).filter((hue) => hue !== null);
    const user: StoredUser = existing
      ? { ...existing, email: identity.email }
      : {
          email: identity.email,
          name: defaultName(identity.email),
          hue: pickHue(hues),
          peerStyle: "eyes",
          reminderTime: DEFAULT_REMINDER_TIME,
        };
    this.#users.set(identity.id, user);
    await this.#save();
    return { id: identity.id, ...user };
  }

  /** Everyone who has signed in, by name. Only what others may see of them. */
  list(): Person[] {
    return [...this.#users]
      .map(([id, { name, hue }]) => ({ id, name, hue }))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }

  /** When this user wants reminders for to-dos without a time, or undefined if we don't know them. */
  reminderTime(id: string): string | undefined {
    return this.#users.get(id)?.reminderTime;
  }

  /** The user's email, as a contact for the push services that deliver their notifications. */
  email(id: string): string | undefined {
    return this.#users.get(id)?.email;
  }

  /**
   * Changes are applied as given, so validate them first (see normalizeName, isValidColor,
   * isPeerStyle, isTimeOfDay).
   */
  async update(
    identity: Identity,
    changes: Partial<Pick<UserProfile, "name" | "hue" | "peerStyle" | "reminderTime">>,
  ): Promise<UserProfile> {
    const user = { ...(await this.ensure(identity)), ...changes };
    const { id, ...stored } = user;
    this.#users.set(id, stored);
    await this.#save();
    return user;
  }

  #save(): Promise<void> {
    return this.#file.write(Object.fromEntries(this.#users));
  }
}

/** The part of the email before the `@`, as a starting point the user can change. */
export function defaultName(email: string): string {
  const localPart = email.split("@")[0]?.trim() ?? "";
  return (localPart === "" ? email : localPart).slice(0, MAX_NAME_LENGTH);
}

/** The available hue farthest from all the given ones, so every user's color stands apart. */
export function pickHue(hues: number[], random = Math.random): number {
  const choices = HUES.map(({ hue }) => hue);
  if (hues.length === 0) return choices[Math.floor(random() * choices.length)] ?? 0;
  let best = 0;
  let bestDistance = -1;
  for (const hue of choices) {
    const distance = Math.min(...hues.map((other) => hueDistance(hue, other)));
    if (distance > bestDistance) {
      best = hue;
      bestDistance = distance;
    }
  }
  return best;
}

function hueDistance(a: number, b: number): number {
  const difference = Math.abs(a - b) % 360;
  return Math.min(difference, 360 - difference);
}

/** A user from the file, filling in settings added since it was saved. */
function parseStoredUser(value: unknown): StoredUser | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("email" in value) ||
    typeof value.email !== "string" ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !("hue" in value) ||
    (value.hue !== null && typeof value.hue !== "number")
  ) {
    return undefined;
  }
  const peerStyle = "peerStyle" in value && isPeerStyle(value.peerStyle) ? value.peerStyle : "eyes";
  const reminderTime =
    "reminderTime" in value && isTimeOfDay(value.reminderTime)
      ? value.reminderTime
      : DEFAULT_REMINDER_TIME;
  return { email: value.email, name: value.name, hue: value.hue, peerStyle, reminderTime };
}
