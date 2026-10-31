import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { compression } from "vite-plugin-compression2";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "src/client"),
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    // Precompress at max quality once, rather than per request. The server picks the variant.
    compression({
      include: /\.(html|css|js|svg|wasm)$/,
      algorithms: ["brotliCompress", "gzip"],
      threshold: 1024,
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src/client") },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/client"),
    emptyOutDir: true,
    target: "es2023",
    rolldownOptions: {
      output: {
        // Put third-party code loaded at startup in its own chunks, split automatically by size
        // (bytes of source before minification). Libraries change less often than the app, so
        // these stay cached across deploys (assets are cached as immutable). `$initial` leaves
        // lazy-loaded code like the editor in its own chunk.
        codeSplitting: {
          groups: [
            {
              name: "vendor",
              test: /node_modules/,
              tags: ["$initial"],
              minSize: 100_000,
              maxSize: 1_000_000,
            },
          ],
        },
      },
    },
  },
});
