import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const databaseSource = fileURLToPath(
  new URL("./packages/database/src/index.ts", import.meta.url),
);

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "json", "html"],
    },
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    fileParallelism: false,
    include: ["apps/**/*.spec.ts", "packages/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@admission/database": databaseSource,
    },
  },
});
