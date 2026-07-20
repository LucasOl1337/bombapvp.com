import { defineConfig } from "vitest/config";

const TEST_FILE_GLOB = "tests/**/*.{test,spec}.?(c|m)[jt]s?(x)";

const UI_TEST_FILES = [
  "tests/app.test.ts",
  "tests/lab-console.test.ts",
  "tests/online-client-ui.test.ts",
];

// These suites execute complete matches or replay batches. Keep this list explicit
// so adding a slow gate is a deliberate choice instead of slowing every contract run.
const GATE_TEST_FILES = [
  "tests/bomb-pingo-league.test.mjs",
  "tests/bomb-pingo-league-open.test.mjs",
  "tests/bomb-pingo-league-sparse.test.mjs",
  "tests/bot-bomb-development.test.mjs",
  "tests/bot-pingo-development.test.mjs",
  "tests/bot-v2-evaluation.test.mjs",
  "tests/bot-v3-match.test.mjs",
];

export default defineConfig({
  test: {
    environment: "node",
    projects: [
      {
        test: {
          name: "contracts-node",
          environment: "node",
          include: [TEST_FILE_GLOB, "GameMechanics/**/*.test.ts"],
          exclude: [...UI_TEST_FILES, ...GATE_TEST_FILES],
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: "contracts-ui",
          environment: "happy-dom",
          include: UI_TEST_FILES,
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: "gates-node",
          environment: "node",
          include: GATE_TEST_FILES,
          // Full-match gates are CPU-bound. Serial files keep each worker task
          // below the RPC watchdog and avoid multiplying simulation latency.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
