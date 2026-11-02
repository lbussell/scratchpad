import path from "node:path";
import webpush from "web-push";
import type { PushPayload, PushSubscriptionData } from "../shared/schema.ts";
import { JsonFileWriter, readJsonFile, writeFileAtomically } from "./files.ts";

/** A device that gets notifications: its browser's subscription, whose it is, and where it is. */
export interface DeviceSubscription extends PushSubscriptionData {
  userId: string;
  /** The device's IANA time zone, which its reminders' times are in. */
  timeZone: string;
}

/**
 * The devices that get notifications, kept in a JSON file by endpoint (which each browser makes
 * up for itself). A device belongs to whoever subscribed it last, so it moves to the next person
 * who signs in on it.
 */
export class PushSubscriptionStore {
  readonly #file: JsonFileWriter;
  readonly #devices: Map<string, DeviceSubscription>;

  private constructor(file: string, devices: Map<string, DeviceSubscription>) {
    this.#file = new JsonFileWriter(file);
    this.#devices = devices;
  }

  static async open(dataDir: string): Promise<PushSubscriptionStore> {
    const file = path.join(dataDir, "push-subscriptions.json");
    const parsed = await readJsonFile(file);
    const devices = new Map<string, DeviceSubscription>();
    if (Array.isArray(parsed)) {
      for (const value of parsed) {
        if (isDeviceSubscription(value)) devices.set(value.endpoint, value);
      }
    }
    return new PushSubscriptionStore(file, devices);
  }

  all(): DeviceSubscription[] {
    return [...this.#devices.values()];
  }

  get(endpoint: string): DeviceSubscription | undefined {
    return this.#devices.get(endpoint);
  }

  async save(device: DeviceSubscription): Promise<void> {
    this.#devices.set(device.endpoint, device);
    await this.#save();
  }

  /** Forgets the device, if it's there (and, given a user, only if it's theirs). */
  async remove(endpoint: string, userId?: string): Promise<void> {
    const device = this.#devices.get(endpoint);
    if (!device || (userId !== undefined && device.userId !== userId)) return;
    this.#devices.delete(endpoint);
    await this.#save();
  }

  #save(): Promise<void> {
    return this.#file.write(this.all());
  }
}

export function isPushSubscriptionData(value: unknown): value is PushSubscriptionData {
  if (typeof value !== "object" || value === null) return false;
  if (!("endpoint" in value) || typeof value.endpoint !== "string") return false;
  if (!("keys" in value) || typeof value.keys !== "object" || value.keys === null) return false;
  const { keys } = value;
  return (
    // Push services are only ever HTTPS. This also keeps the server from posting anywhere else.
    URL.parse(value.endpoint)?.protocol === "https:" &&
    "p256dh" in keys &&
    typeof keys.p256dh === "string" &&
    "auth" in keys &&
    typeof keys.auth === "string"
  );
}

function isDeviceSubscription(value: unknown): value is DeviceSubscription {
  return (
    isPushSubscriptionData(value) &&
    "userId" in value &&
    typeof value.userId === "string" &&
    "timeZone" in value &&
    isTimeZone(value.timeZone)
  );
}

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone !== "";
  } catch {
    return false;
  }
}

/** The key pair push services know this server by (VAPID). */
export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/**
 * This server's VAPID keys, made on first run. Subscriptions are tied to the public key, so
 * keep the file: with new keys, every device has to turn notifications on again.
 */
export async function loadVapidKeys(dataDir: string): Promise<VapidKeys> {
  const file = path.join(dataDir, "vapid-keys.json");
  const saved = await readJsonFile(file);
  if (
    typeof saved === "object" &&
    saved !== null &&
    "publicKey" in saved &&
    typeof saved.publicKey === "string" &&
    "privateKey" in saved &&
    typeof saved.privateKey === "string"
  ) {
    return { publicKey: saved.publicKey, privateKey: saved.privateKey };
  }
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  await writeFileAtomically(file, `${JSON.stringify({ publicKey, privateKey }, null, 2)}\n`);
  return { publicKey, privateKey };
}

/** What happened: "gone" means the device unsubscribed or deleted the app, so forget it. */
export type PushResult = "sent" | "gone" | "failed";

/** Sends a notification to a device. Fails quietly (it's logged): it's only a notification. */
export async function sendPush(
  device: PushSubscriptionData,
  payload: PushPayload,
  { keys, contact }: { keys: VapidKeys; contact: string },
): Promise<PushResult> {
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: device.keys },
      JSON.stringify(payload),
      {
        vapidDetails: { subject: contact, ...keys },
        // A reminder that arrives a day late is no use.
        TTL: 12 * 60 * 60,
        urgency: "high",
      },
    );
    return "sent";
  } catch (error) {
    if (error instanceof webpush.WebPushError && [404, 410].includes(error.statusCode)) {
      return "gone";
    }
    console.error(`Couldn’t send a notification to ${new URL(device.endpoint).host}:`, error);
    return "failed";
  }
}
