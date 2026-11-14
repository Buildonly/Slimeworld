import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    // Placeholder service addresses for unit tests; every call is faked.
    env: { DATABASE_URL: "postgres://unit-test.invalid/none", NEAR_AI_URL: "https://near-ai.test/v1", NEAR_AI_MODEL: "test/model", ONECLICK_URL: "https://oneclick.test", ELEVENLABS_URL: "https://voice.test" },
  },
});
