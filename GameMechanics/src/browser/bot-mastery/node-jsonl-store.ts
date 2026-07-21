import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { BotExperienceEvent, ExperienceSink } from "./contracts.ts";

/**
 * Single-writer append-only JSONL segment for supervised/offline lab runs.
 * Callers allocate one path per run/worker; merging segments is an offline,
 * deterministic operation rather than a shared concurrent write.
 */
export function createJsonlExperienceSink(filePath: string): ExperienceSink {
  const target = resolve(filePath);
  mkdirSync(dirname(target), { recursive: true });
  return Object.freeze({
    append(event: BotExperienceEvent): void {
      appendFileSync(target, `${JSON.stringify(event)}\n`, { encoding: "utf8", flag: "a" });
    },
  });
}
