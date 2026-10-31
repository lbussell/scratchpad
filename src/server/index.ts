import { createServer } from "node:http";
import path from "node:path";
import express from "express";
import expressStaticGzip from "express-static-gzip";
import { WebSocketServer } from "ws";
import { ROOT_DOC_API_PATH, type RootDocResponse, SYNC_PATH } from "../shared/schema.ts";
import { config } from "./config.ts";
import { createSyncRepo, ensureRootDoc } from "./repo.ts";

const app = express();
const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });
httpServer.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  if (pathname === SYNC_PATH) {
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  } else if (config.isProduction) {
    socket.destroy();
  }
  // In development, Vite's HMR server handles every other upgrade.
});

const repo = createSyncRepo(wss, config.dataDir);
const rootDocUrl = await ensureRootDoc(repo, config.dataDir);

app.get(ROOT_DOC_API_PATH, (_request, response) => {
  response.json({ url: rootDocUrl } satisfies RootDocResponse);
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

httpServer.listen(config.port, () => {
  console.info(`Listening on http://localhost:${config.port}`);
});

async function shutdown(): Promise<void> {
  await repo.shutdown();
  wss.close();
  httpServer.close();
  process.exit(0);
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
