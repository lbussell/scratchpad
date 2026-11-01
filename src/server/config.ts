import path from "node:path";
import { type AuthConfig, identityHeaderNames } from "./auth.ts";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const isProduction = process.env["NODE_ENV"] === "production";

const auth: AuthConfig = {
  headers: identityHeaderNames(process.env, isProduction),
  loginUrl: process.env["AUTH_LOGIN_URL"],
  logoutUrl: process.env["AUTH_LOGOUT_URL"],
  // Outside production there's no proxy, so requests without identity headers get this user.
  devUser: isProduction
    ? undefined
    : {
        id: process.env["DEV_USER_ID"] ?? "dev",
        email: process.env["DEV_USER_EMAIL"] ?? "dev@example.com",
      },
};

export const config = {
  isProduction,
  host: process.env["HOST"],
  port: Number(process.env["PORT"] ?? (isProduction ? 8000 : 8001)),
  projectRoot,
  dataDir: path.resolve(projectRoot, process.env["DATA_DIR"] ?? "data"),
  clientDir: path.join(projectRoot, "dist/client"),
  auth,
};
