import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/loader.ts",
      name: "AIChatbotWidgetSDK",
      fileName: () => "loader.js",
      formats: ["iife"],
    },
    target: "es2020",
    emptyOutDir: true,
  },
});
