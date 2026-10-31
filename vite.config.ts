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
        // Large libraries change less often than the app, so give them their own chunks to keep
        // them cached across deploys (assets are cached as immutable).
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "base-ui", test: /node_modules[\\/]@(base-ui|floating-ui)[\\/]/ },
          ],
        },
      },
    },
  },
});
