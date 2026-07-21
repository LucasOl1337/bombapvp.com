import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { CampaignResult } from "../src/browser/bot-mastery/campaign.ts";
import {
  evaluateTechniquePromotion,
  applyTechniqueCuration,
  selectTechniquePortfolio,
} from "../src/browser/bot-mastery/promotion.ts";
import { BOT_MASTERY_CURATION } from "./bot-mastery-curation.ts";

const inputArgument = process.argv[2];
if (!inputArgument) {
  throw new Error("Usage: vite-node GameMechanics/scripts/project-bot-mastery-campaign.ts <campaign.json>");
}
const target = resolve(inputArgument);
const raw = JSON.parse(readFileSync(target, "utf8")) as {
  schemaVersion: number;
  campaignVersion: string;
  results: CampaignResult[];
};
const results = raw.results.map((result) => {
  const successful = result.candidate.flatMap((match) =>
    match.opportunityTrace.filter(({ success }) => success));
  const evaluation = {
    ...result.evaluation,
    candidateOpportunities: result.candidate.reduce(
      (sum, match) => sum + match.opportunities,
      0,
    ),
    candidateSuccessfulOutcomes: successful.length,
    distinctSuccessfulTrajectories: new Set(successful.map(({ selfTile, opponentTile }) =>
      `${selfTile.x},${selfTile.y}->${opponentTile.x},${opponentTile.y}`)).size,
  };
  return {
    ...result,
    evaluation,
    promotion: evaluateTechniquePromotion(
      result.spec.candidate,
      evaluation,
      "captain-supervised-codex",
    ),
  };
});
const portfolio = selectTechniquePortfolio(results.map((result) => ({
  candidate: result.spec.candidate,
  evaluation: result.evaluation,
  promotion: result.promotion,
})));
const curation = applyTechniqueCuration(portfolio, BOT_MASTERY_CURATION);
writeFileSync(target, `${JSON.stringify({ ...raw, results, portfolio, curation }, null, 2)}\n`, "utf8");
process.stdout.write(`${target}\n`);
