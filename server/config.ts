import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");

export const config = {
  isProduction: process.env["NODE_ENV"] === "production",
  port: Number(process.env["PORT"] ?? 3000),
  projectRoot,
  dataDir: path.resolve(projectRoot, process.env["DATA_DIR"] ?? "data"),
  clientDir: path.join(projectRoot, "dist/client"),
};
