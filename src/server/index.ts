import { createServer } from "node:http";
import path from "node:path";
import express, { type Request } from "express";
import expressStaticGzip from "express-static-gzip";
import { WebSocketServer } from "ws";
import {
  MAX_NAME_LENGTH,
  normalizeName,
  PROFILE_API_PATH,
  SESSION_API_PATH,
  type SessionResponse,
  SYNC_PATH,
} from "../shared/schema.ts";
import { type Identity, identify, loginRedirectUrl } from "./auth.ts";
import { config } from "./config.ts";
import { createSyncRepo, ensureRootDoc } from "./repo.ts";
import { UserStore } from "./users.ts";

const app = express();
const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });
httpServer.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  if (pathname === SYNC_PATH) {
    if (!identify(request.headers, config.auth)) {
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

// Everything requires a signed-in user. Visitors asking for a page go to the login page, if
// there is one; everything else gets a 401.
app.use((request, response, next) => {
  if (identify(request.headers, config.auth)) {
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
  const identity = identify(request.headers, config.auth);
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

// Only ever changes the requester's own profile.
app.patch(PROFILE_API_PATH, express.json(), async (request, response) => {
  const body: unknown = request.body;
  const rawName =
    typeof body === "object" && body !== null && "name" in body ? body.name : undefined;
  const name = typeof rawName === "string" ? normalizeName(rawName) : undefined;
  if (name === undefined) {
    response.status(400).json({ error: `Name must be 1 to ${MAX_NAME_LENGTH} characters` });
    return;
  }
  response.json(await users.rename(identityOf(request), name));
});

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
  await repo.shutdown();
  wss.close();
  httpServer.close();
  process.exit(0);
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
