import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { runTechniqueCampaign } from "../src/browser/bot-mastery/campaign.ts";
import {
  applyTechniqueCuration,
  selectTechniquePortfolio,
} from "../src/browser/bot-mastery/promotion.ts";
import { BOT_MASTERY_CANDIDATES } from "./bot-mastery-candidates.ts";
import { BOT_MASTERY_CURATION } from "./bot-mastery-curation.ts";

const outputArgument = process.argv[2];
if (!outputArgument) {
  throw new Error("Usage: vite-node GameMechanics/scripts/run-bot-mastery-campaign.ts <output.json>");
}

const results = BOT_MASTERY_CANDIDATES.map((spec) => {
  const seeds = Object.freeze(Array.from(
    { length: 12 },
    (_, index) => `mastery-${spec.championSlug}-v1-seed-${String(index + 1).padStart(2, "0")}`,
  ));
  process.stderr.write(`training ${spec.candidate.id} (${seeds.length} paired seeds + replay)\n`);
  return runTechniqueCampaign(spec, seeds);
});

const output = resolve(outputArgument);
const portfolio = selectTechniquePortfolio(results.map((result) => ({
  candidate: result.spec.candidate,
  evaluation: result.evaluation,
  promotion: result.promotion,
})));
const curation = applyTechniqueCuration(portfolio, BOT_MASTERY_CURATION);
writeFileSync(output, `${JSON.stringify({
  schemaVersion: 1,
  campaignVersion: "bot-mastery-initial-v1",
  results,
  portfolio,
  curation,
}, null, 2)}\n`, "utf8");
process.stdout.write(`${output}\n`);
