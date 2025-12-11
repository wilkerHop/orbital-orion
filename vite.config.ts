import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vitest/config";

// Custom plugin to copy manifest and build extension scripts
const chromeExtensionPlugin = () => ({
  name: "chrome-extension",
  closeBundle: () => {
    // Copy manifest.json to dist
    copyFileSync(
      resolve(__dirname, "public/manifest.json"),
      resolve(__dirname, "dist/manifest.json")
    );
    
    // Copy offscreen.html to correct location
    if (existsSync(resolve(__dirname, "dist/public/offscreen.html"))) {
      copyFileSync(
        resolve(__dirname, "dist/public/offscreen.html"),
        resolve(__dirname, "dist/offscreen.html")
      );
    }
  },
});

export default defineConfig({
  plugins: [react(), chromeExtensionPlugin()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/shell/background/**",
        "src/shell/content/**",
        "src/shell/offscreen/**",
        "src/shell/persistence/**",
        "src/shell/messaging/types.ts",
        "src/inject/**",
        "src/popup/**",
        "src/core/types/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "src/shell/background/service-worker.ts"),
        loader: resolve(__dirname, "src/shell/content/loader.ts"),
        "main-world": resolve(__dirname, "src/inject/main-world.ts"),
        offscreen: resolve(__dirname, "public/offscreen.html"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "loader") {
            return "content/[name].js";
          }
          return "[name].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
  publicDir: "public",
});
