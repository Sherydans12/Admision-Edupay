import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "json", "html"],
    },
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    fileParallelism: false,
    include: ["apps/**/*.spec.ts", "packages/**/*.spec.ts"],
  },
});
