import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts", "./src/client/setupTests.ts"],
    globals: true,
  },
});
