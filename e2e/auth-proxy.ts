// Stands in for the auth proxy in front of a production server (docs/deploy.md), for tests of
// what development leaves out. Like exe.dev's, it signs people in with a cookie, which the
// browser sends on every request, including ones Playwright's extra headers don't reach (like
// the service worker's). The `e2e-user` cookie holds the user's email (see signInCookie()).
//   node e2e/auth-proxy.ts <listen port> <server port>
import { createServer, type IncomingHttpHeaders, request } from "node:http";
import { connect } from "node:net";

const [listenPort, serverPort] = process.argv.slice(2).map(Number);
if (!listenPort || !serverPort) throw new Error("Usage: auth-proxy.ts <listen port> <server port>");

/** The request's headers, with identity headers from its cookie rather than from the browser. */
function withIdentity(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const forwarded = { ...headers };
  delete forwarded["x-user-id"];
  delete forwarded["x-user-email"];
  const cookie = /(?:^|;\s*)e2e-user=([^;]+)/.exec(headers.cookie ?? "")?.[1];
  if (cookie === undefined) return forwarded;
  const email = decodeURIComponent(cookie);
  return { ...forwarded, "x-user-id": `id-${email}`, "x-user-email": email };
}

const proxy = createServer((incoming, outgoing) => {
  const forwarded = request(
    {
      port: serverPort,
      path: incoming.url,
      method: incoming.method,
      headers: withIdentity(incoming.headers),
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    },
  );
  forwarded.on("error", () => outgoing.writeHead(502).end());
  incoming.pipe(forwarded);
});

// WebSockets (/sync): replay the request with the identity added, then join the two sockets.
proxy.on("upgrade", (incoming, socket, head) => {
  const upstream = connect(serverPort, "127.0.0.1", () => {
    const headers = Object.entries(withIdentity(incoming.headers)).flatMap(([name, value]) =>
      (Array.isArray(value) ? value : [value]).map((one) => `${name}: ${one}\r\n`),
    );
    upstream.write(`${incoming.method} ${incoming.url} HTTP/1.1\r\n${headers.join("")}\r\n`);
    upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

proxy.listen(listenPort);
