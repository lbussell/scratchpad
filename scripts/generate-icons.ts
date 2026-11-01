// Renders the Home Screen icons from scripts/app-icon.svg. Run after changing it:
//   node scripts/generate-icons.ts
// The artwork keeps inside the central 80% circle, so the same image works as a maskable icon.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const publicDir = path.resolve(import.meta.dirname, "../src/client/public");
const svg = await readFile(path.join(import.meta.dirname, "app-icon.svg"), "utf8");
const sizes = { "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180 };

const browser = await chromium.launch();
await Promise.all(
  Object.entries(sizes).map(async ([file, size]) => {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: path.join(publicDir, file) });
  }),
);
await browser.close();
