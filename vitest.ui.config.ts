import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootNodeModules = resolve(__dirname, "node_modules");

export default defineConfig({
  resolve: {
    alias: {
      react: resolve(rootNodeModules, "react"),
      "react-dom": resolve(rootNodeModules, "react-dom"),
      "react-dom/client": resolve(rootNodeModules, "react-dom/client.js"),
      "react/jsx-dev-runtime": resolve(rootNodeModules, "react/jsx-dev-runtime.js"),
      "react/jsx-runtime": resolve(rootNodeModules, "react/jsx-runtime.js"),
      "next/link": resolve(__dirname, "test/ui/next-link-mock.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/ui/setup.ts"],
    include: [
      "apps/dashboard/test/**/*.test.tsx",
      "apps/widget/test/**/*.test.tsx",
    ],
  },
});
