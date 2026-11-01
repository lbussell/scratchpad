# Deploy Scratchpad

Scratchpad is designed to run behind a secure HTTPS proxy. Your proxy should
authenticate users and pass user identity headers to Scratchpad. Everything
behind the proxy is fully trusted.

## How sign-in works

Scratchpad must be deployed behind a secure proxy. The proxy must:

- Be the only way to reach the Scratchpad server from the internet.
- Remove any identity headers that the visitor sends, and add its own.
- Forward WebSocket connections to `/sync` with the same identity headers,
  because the app syncs notes over that connection.

> [!WARNING]
> Anyone who can reach the server directly can send their own identity headers
> and impersonate any user. If the proxy runs on the same machine as the server,
> set `HOST=127.0.0.1` so the server accepts connections only from that machine.

## Run the server

You need Node.js 24 or later.

1. Install dependencies and build the client:

   ```sh
   npm ci
   npm run build
   ```

2. Start the server with the names of the headers that your proxy sends:

   ```sh
   AUTH_USER_ID_HEADER=X-User-ID AUTH_EMAIL_HEADER=X-User-Email HOST=127.0.0.1 npm start
   ```

3. Configure the proxy to forward requests to `http://127.0.0.1:8000`.

The server stores all notes and user profiles in the `data/` directory.

## Configuration

The server reads these environment variables:

| Variable              | Default                  | Purpose                                                                |
| --------------------- | ------------------------ | ---------------------------------------------------------------------- |
| `AUTH_USER_ID_HEADER` | None (required)          | Header with the user's stable ID                                       |
| `AUTH_EMAIL_HEADER`   | None (required)          | Header with the user's email                                           |
| `AUTH_LOGIN_URL`      | None (responds 401)      | Where to send signed-out visitors. `{path}` is the page they wanted    |
| `AUTH_LOGOUT_URL`     | None (no log-out button) | URL that the app sends a POST request to when someone logs out         |
| `PORT`                | `8000`                   | Port to listen on                                                      |
| `HOST`                | All interfaces           | Address to listen on                                                   |
| `DATA_DIR`            | `data`                   | Directory for notes and user profiles, relative to the repository root |

## Deploy on exe.dev

Scratchpad was designed to be deployed on exe.dev. Use the following steps to
deploy it:

1. Create a VM and deploy this repository by following exe.dev's
   [Node.js recipe](https://exe.dev/deploy/nodejs).
2. Set these environment variables for the app before it first starts. The
   server doesn't start without the two header variables.

   ```sh
   AUTH_USER_ID_HEADER=X-ExeDev-UserID
   AUTH_EMAIL_HEADER=X-ExeDev-Email
   AUTH_LOGIN_URL='/__exe.dev/login?redirect={path}'
   AUTH_LOGOUT_URL=/__exe.dev/logout
   HOST=127.0.0.1
   DATA_DIR=/home/exedev/data
   ```

   `DATA_DIR` must point outside the app's code directory, because a redeploy
   can replace that directory and the notes in it.

3. [Share the VM](https://exe.dev/docs/sharing) with the people who will use
   Scratchpad.

Don't make Scratchpad public. It is designed to be a private collaboration
space.
