import fs from "node:fs/promises";
import path from "node:path";
import { HUES, isPeerStyle, MAX_NAME_LENGTH, type UserProfile } from "../shared/schema.ts";
import type { Identity } from "./auth.ts";

type StoredUser = Omit<UserProfile, "id">;

/**
 * User profiles, kept in a JSON file. Profiles live on the server rather than in a shared
 * Automerge document so that each user can only change their own.
 */
export class UserStore {
  readonly #file: string;
  readonly #users: Map<string, StoredUser>;
  #saving: Promise<void> = Promise.resolve();

  private constructor(file: string, users: Map<string, StoredUser>) {
    this.#file = file;
    this.#users = users;
  }

  static async open(dataDir: string): Promise<UserStore> {
    const file = path.join(dataDir, "users.json");
    const users = new Map<string, StoredUser>();
    const contents = await fs.readFile(file, "utf8").catch(() => undefined);
    if (contents !== undefined) {
      const parsed: unknown = JSON.parse(contents);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [id, value] of Object.entries(parsed)) {
          const user = parseStoredUser(value);
          if (user) users.set(id, user);
        }
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
        };
    this.#users.set(identity.id, user);
    await this.#save();
    return { id: identity.id, ...user };
  }

  /**
   * Changes are applied as given, so validate them first (see normalizeName, isValidColor,
   * isPeerStyle).
   */
  async update(
    identity: Identity,
    changes: Partial<Pick<UserProfile, "name" | "hue" | "peerStyle">>,
  ): Promise<UserProfile> {
    const user = { ...(await this.ensure(identity)), ...changes };
    const { id, ...stored } = user;
    this.#users.set(id, stored);
    await this.#save();
    return user;
  }

  #save(): Promise<void> {
    const contents = `${JSON.stringify(Object.fromEntries(this.#users), null, 2)}\n`;
    // Serialize writes, and keep going after a failed one.
    const write = () => writeFileAtomically(this.#file, contents);
    this.#saving = this.#saving.then(write, write);
    return this.#saving;
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

async function writeFileAtomically(file: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, contents);
  await fs.rename(temporary, file);
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
  return { email: value.email, name: value.name, hue: value.hue, peerStyle };
}
