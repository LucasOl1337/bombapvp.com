import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tarefas/online-pvp-global/prototypes/**/*.test.mjs"],
  },
});
