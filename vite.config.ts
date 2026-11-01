import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { compression } from "vite-plugin-compression2";
import { VitePWA } from "vite-plugin-pwa";
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
    // Makes the app installable (manifest.webmanifest) and able to open offline (src/client/sw.ts).
    VitePWA({
      strategies: "injectManifest",
      srcDir: ".",
      filename: "sw.ts",
      // main.tsx registers the worker, only in production builds.
      injectRegister: false,
      // The auth proxy needs cookies to let the browser fetch the manifest.
      useCredentials: true,
      manifest: {
        id: "/",
        name: "Scratchpad",
        short_name: "Scratchpad",
        description: "Collaborative notes",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fcfcfd",
        theme_color: "#fcfcfd",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        // Everything the app needs to start, including Automerge's WebAssembly, but not the
        // precompressed copies.
        globPatterns: ["**/*.{html,js,css,svg,png,wasm,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: 10_000_000,
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src/client") },
  },
  // Lets the dev server answer through exe.dev's proxy (https://<vm>.exe.xyz:8001/).
  server: { allowedHosts: [".exe.xyz"] },
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
