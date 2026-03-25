import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  define: {
    __QAF_JIRA_BOARD_ALLOWLIST__: JSON.stringify(""),
  },
});
