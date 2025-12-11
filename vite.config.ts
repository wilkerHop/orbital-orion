import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import manifest from "./public/manifest.json";

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
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
    outDir: "dist",
    emptyOutDir: true,
  },
  publicDir: "public",
});
