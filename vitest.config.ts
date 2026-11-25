import { defineConfig } from "vitest/config";

/**
 * The repository has both Vitest suites and Node's built-in test suites.
 * Keep Vitest focused on its own tests; Node suites run through `node --test`.
 */
export default defineConfig({
  test: {
    include: [
      "tests/**/*.test.ts",
      "tests/architecture/layers-03-07.test.mjs",
      "tests/layer-02/layer-02-architecture.test.mjs",
    ],
  },
});
