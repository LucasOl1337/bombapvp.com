import type { TechniqueCurationReview } from "../src/browser/bot-mastery/contracts.ts";

export const BOT_MASTERY_CURATION: readonly TechniqueCurationReview[] = Object.freeze([
  Object.freeze({
    candidateId: "ranni.danger-blink.v1",
    reviewer: "codex-xhigh-trace-review",
    approved: true,
    rationale: "18/18 direct danger-survival outcomes, self-eliminations fell 2 to 0, and wins did not regress.",
  }),
  Object.freeze({
    candidateId: "ranni.proximity-blink.v1",
    reviewer: "codex-xhigh-trace-review",
    approved: false,
    rationale: "Wins fell 5/12 to 1/12 and proximity casts caused long stalls.",
  }),
  Object.freeze({
    candidateId: "killer-bee.aligned-dash.v1",
    reviewer: "codex-xhigh-trace-review",
    approved: false,
    rationale: "All dash successes were orientation-specific; the declarative action cannot aim Wing Dash.",
  }),
  Object.freeze({
    candidateId: "killer-bee.close-dash.v1",
    reviewer: "codex-xhigh-trace-review",
    approved: false,
    rationale: "Only 24/138 outcomes succeeded, with no match benefit and inflated relative delta.",
  }),
  Object.freeze({
    candidateId: "crocodilo.close-surge.v1",
    reviewer: "codex-xhigh-trace-review",
    approved: false,
    rationale: "The apparent 2/12 to 9/12 win gain had 0/15 declared surge outcomes and strong trajectory bias.",
  }),
  Object.freeze({
    candidateId: "crocodilo.danger-surge.v1",
    reviewer: "codex-xhigh-trace-review",
    approved: false,
    rationale: "No win, objective, or Champion-specific outcome improvement was observed.",
  }),
  Object.freeze({
    candidateId: "thresh.aligned-hook.v1",
    reviewer: "codex-xhigh-trace-review",
    approved: false,
    rationale: "The apparent wins were entirely side-biased and no one of 24 hooks reduced target distance.",
  }),
  Object.freeze({
    candidateId: "thresh.close-hook.v1",
    reviewer: "codex-xhigh-trace-review",
    approved: false,
    rationale: "Only 6/18 outcomes succeeded; diagonal/co-located proximity is not a valid cardinal hook target.",
  }),
]);
