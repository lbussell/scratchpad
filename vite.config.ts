import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { compression } from "vite-plugin-compression2";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "src/client"),
  plugins: [
    react(),
    wasm(),
    // Precompress at max quality once, rather than per request. The server picks the variant.
    compression({
      include: /\.(html|css|js|svg|wasm)$/,
      algorithms: ["brotliCompress", "gzip"],
      threshold: 1024,
    }),
  ],
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/client"),
    emptyOutDir: true,
    target: "es2023",
  },
});
