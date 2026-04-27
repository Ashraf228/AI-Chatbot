import { defineConfig } from "vitest/config";

export default defineConfig({
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
