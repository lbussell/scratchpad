import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "src/client"),
  plugins: [react(), wasm()],
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/client"),
    emptyOutDir: true,
    target: "es2023",
  },
});
