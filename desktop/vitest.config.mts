import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Les tests du cœur tournent sous Node ordinaire : better-sqlite3-multiple-ciphers 13 est en Node-API,
// même binaire qu'Electron (D734).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["coeur/**/*.test.ts"],
  },
});
