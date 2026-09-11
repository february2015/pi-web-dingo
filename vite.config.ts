import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Chrome MV3 extension build. Output is a flat `dist/` directory that
// can be loaded via `chrome://extensions` → "Load unpacked".
function copyStaticAssets(): void {
  mkdirSync("dist", { recursive: true });
  copyFileSync("public/manifest.json", "dist/manifest.json");
  // Copy i18n locale message bundles (`public/_locales/<lang>/messages.json`)
  // so `chrome.i18n.getMessage` can read them at runtime.
  const localesDir = "public/_locales";
  if (existsSync(localesDir)) {
    const outLocales = join("dist", "_locales");
    mkdirSync(outLocales, { recursive: true });
    for (const lang of readdirSync(localesDir)) {
      const src = join(localesDir, lang);
      const dst = join(outLocales, lang);
      mkdirSync(dst, { recursive: true });
      for (const f of readdirSync(src)) {
        copyFileSync(join(src, f), join(dst, f));
      }
    }
  }
  mkdirSync("dist/icons", { recursive: true });
  for (const f of readdirSync("icons")) {
    copyFileSync(join("icons", f), join("dist", "icons", f));
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-static-assets",
      closeBundle() {
        copyStaticAssets();
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: "src/extension/content.tsx",
        background: "src/extension/background.ts",
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "content") return "content.js";
          if (chunk.name === "background") return "background.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) return "dingo.css";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    open: false,
  },
});
