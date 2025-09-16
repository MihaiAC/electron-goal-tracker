/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react({
      // Explicitly set options to fix preamble detection
      jsxRuntime: "automatic",
      babel: {
        plugins: [],
        babelrc: false,
        configFile: false,
      },
    }),
    tailwindcss(),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
});
