import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["coeur/**/*.test.ts", "electron/**/*.test.ts"],
    passWithNoTests: true,
  },
});
