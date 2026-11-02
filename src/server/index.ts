import { createServer } from "node:http";
import path from "node:path";
import express, { type Request } from "express";
import expressStaticGzip from "express-static-gzip";
import { WebSocketServer } from "ws";
import {
  isPeerStyle,
  isTimeOfDay,
  isValidColor,
  MAX_NAME_LENGTH,
  normalizeName,
  PROFILE_API_PATH,
  PUSH_KEY_API_PATH,
  PUSH_SUBSCRIPTION_API_PATH,
  PUSH_TEST_API_PATH,
  type PushKeyResponse,
  type PushPayload,
  SESSION_API_PATH,
  type SessionResponse,
  SYNC_PATH,
  type UpdateProfileRequest,
  USERS_API_PATH,
} from "../shared/schema.ts";
import { type Identity, identify, loginRedirectUrl } from "./auth.ts";
import { config } from "./config.ts";
import {
  type DeviceSubscription,
  isPushSubscriptionData,
  isTimeZone,
  loadVapidKeys,
  PushSubscriptionStore,
  sendPush,
} from "./push.ts";
import { ReminderScheduler, todosIn } from "./reminders.ts";
import { createSyncRepo, ensureRootDoc } from "./repo.ts";
import { UserStore } from "./users.ts";

const app = express();
const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });
httpServer.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  if (pathname === SYNC_PATH) {
    if (!identify(request, config.auth)) {
      socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  } else if (config.isProduction) {
    socket.destroy();
  }
  // In development, Vite's HMR server handles every other upgrade.
});

const repo = createSyncRepo(wss, config.dataDir);
const rootDocUrl = await ensureRootDoc(repo, config.dataDir);
const users = await UserStore.open(config.dataDir);
const devices = await PushSubscriptionStore.open(config.dataDir);
const vapidKeys = await loadVapidKeys(config.dataDir);

/** Sends a notification to a device, as the contact the deployment gave, or the device's user. */
function notify(device: DeviceSubscription, payload: PushPayload) {
  const contact = config.pushContact ?? `mailto:${users.email(device.userId) ?? ""}`;
  return sendPush(device, payload, { keys: vapidKeys, contact });
}

const reminders = new ReminderScheduler({
  dataDir: config.dataDir,
  listTodos: () => todosIn(repo, rootDocUrl),
  devices,
  reminderTimeOf: (userId) => users.reminderTime(userId),
  send: notify,
});
await reminders.start();

// Everything requires a signed-in user. Visitors asking for a page go to the login page, if
// there is one; everything else gets a 401.
app.use((request, response, next) => {
  if (identify(request, config.auth)) {
    next();
    return;
  }
  const wantsPage = request.method === "GET" && !request.path.startsWith("/api/");
  if (config.auth.loginUrl !== undefined && wantsPage && request.accepts("html") !== false) {
    response.redirect(loginRedirectUrl(config.auth.loginUrl, request.originalUrl));
    return;
  }
  response.status(401).json({ error: "Not signed in" });
});

function identityOf(request: Request): Identity {
  const identity = identify(request, config.auth);
  // The middleware above already turned away requests without one.
  if (!identity) throw new Error("Request has no identity");
  return identity;
}

app.get(SESSION_API_PATH, async (request, response) => {
  const session: SessionResponse = {
    rootDocUrl,
    user: await users.ensure(identityOf(request)),
    logoutUrl: config.auth.logoutUrl ?? null,
  };
  response.json(session);
});

// So people can assign each other to-dos.
app.get(USERS_API_PATH, async (request, response) => {
  // Includes the requester, even before they've loaded a session.
  await users.ensure(identityOf(request));
  response.json(users.list());
});

// Only ever changes the requester's own profile.
app.patch(PROFILE_API_PATH, express.json(), async (request, response) => {
  const field = (key: string) => bodyField(request.body, key);

  const changes: UpdateProfileRequest = {};
  const rawName = field("name");
  if (rawName !== undefined) {
    const name = typeof rawName === "string" ? normalizeName(rawName) : undefined;
    if (name === undefined) {
      response.status(400).json({ error: `Name must be 1 to ${MAX_NAME_LENGTH} characters` });
      return;
    }
    changes.name = name;
  }
  const hue = field("hue");
  if (hue !== undefined) {
    if (!isValidColor(hue)) {
      response.status(400).json({ error: "Not one of the available colors" });
      return;
    }
    changes.hue = hue;
  }
  const peerStyle = field("peerStyle");
  if (peerStyle !== undefined) {
    if (!isPeerStyle(peerStyle)) {
      response.status(400).json({ error: "Not one of the ways to show people" });
      return;
    }
    changes.peerStyle = peerStyle;
  }
  const reminderTime = field("reminderTime");
  if (reminderTime !== undefined) {
    if (!isTimeOfDay(reminderTime)) {
      response.status(400).json({ error: "Reminder time must be HH:MM" });
      return;
    }
    changes.reminderTime = reminderTime;
  }
  response.json(await users.update(identityOf(request), changes));
});

// Notifications. A device subscribes with the server's public key, then saves its subscription
// here, again each time the app starts (so its time zone stays current).
app.get(PUSH_KEY_API_PATH, (_request, response) => {
  const key: PushKeyResponse = { publicKey: vapidKeys.publicKey };
  response.json(key);
});

app.post(PUSH_SUBSCRIPTION_API_PATH, express.json(), async (request, response) => {
  const subscription = bodyField(request.body, "subscription");
  const timeZone = bodyField(request.body, "timeZone");
  if (!isPushSubscriptionData(subscription) || !isTimeZone(timeZone)) {
    response.status(400).json({ error: "Needs a push subscription and a time zone" });
    return;
  }
  const { endpoint, keys } = subscription;
  const { id: userId } = await users.ensure(identityOf(request));
  await devices.save({ endpoint, keys, userId, timeZone });
  response.status(204).end();
});

// Only ever the requester's own devices.
app.delete(PUSH_SUBSCRIPTION_API_PATH, express.json(), async (request, response) => {
  const endpoint = bodyField(request.body, "endpoint");
  if (typeof endpoint !== "string") {
    response.status(400).json({ error: "Needs an endpoint" });
    return;
  }
  await devices.remove(endpoint, identityOf(request).id);
  response.status(204).end();
});

// So people can check that notifications reach their device.
app.post(PUSH_TEST_API_PATH, express.json(), async (request, response) => {
  const endpoint = bodyField(request.body, "endpoint");
  const device = typeof endpoint === "string" ? devices.get(endpoint) : undefined;
  if (!device || device.userId !== identityOf(request).id) {
    response.status(404).json({ error: "This device isn’t set up for notifications" });
    return;
  }
  const result = await notify(device, {
    title: "Test notification",
    body: "",
    url: "/#settings",
    tag: "test",
  });
  if (result === "gone") await devices.remove(device.endpoint);
  if (result === "sent") response.status(204).end();
  else response.status(502).json({ error: "Couldn’t reach this device’s push service" });
});

/** A field of a JSON request body, which could be anything. */
function bodyField(body: unknown, key: string): unknown {
  return typeof body === "object" && body !== null && key in body
    ? Reflect.get(body, key)
    : undefined;
}

if (config.isProduction) {
  const hashedAssetsDir = path.join(config.clientDir, "assets");
  // Serves the .br/.gz files written at build time when the browser accepts them.
  app.use(
    expressStaticGzip(config.clientDir, {
      enableBrotli: true,
      orderPreference: ["br"],
      index: false,
      serveStatic: {
        setHeaders: (response, filePath) => {
          // Vite puts a content hash in every filename under assets/, so a URL's content never
          // changes. Everything else (index.html, favicon) keeps revalidating to pick up deploys.
          if (filePath.startsWith(hashedAssetsDir + path.sep)) {
            response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      },
    }),
  );
  app.get("/{*splat}", (_request, response) => {
    response.sendFile(path.join(config.clientDir, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    configFile: path.join(config.projectRoot, "vite.config.ts"),
    appType: "spa",
    server: { middlewareMode: true, hmr: { server: httpServer } },
  });
  app.use(vite.middlewares);
}

// Set HOST (e.g. 127.0.0.1) so only the auth proxy can reach the server: identity headers from
// anywhere else could be forged.
httpServer.listen(config.port, config.host, () => {
  console.info(`Listening on http://${config.host ?? "localhost"}:${config.port}`);
});

async function shutdown(): Promise<void> {
  await reminders.stop();
  await repo.shutdown();
  wss.close();
  httpServer.close();
  process.exit(0);
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
