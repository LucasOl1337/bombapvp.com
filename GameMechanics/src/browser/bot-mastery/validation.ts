import { CHAMPION_MEMBERSHIP, type ChampionSlug } from "../../../../Champions/membership.ts";
import {
  GAME_MECHANICS_VERSION,
  type SkillId,
} from "../../contracts.ts";
import {
  DEFAULT_CONTENT_REVISION,
  DEFAULT_MECHANICS_REVISION,
} from "../../match-config.ts";
import {
  BOT_MASTERY_SCHEMA_VERSION,
  TECHNIQUE_SCHEMA_VERSION,
  type ActiveTechnique,
  type BotModel,
  type CharacterMastery,
  type TechniqueCandidate,
  type TechniqueCompatibility,
  type TechniquePredicate,
} from "./contracts.ts";

export type ValidationResult<T> = Readonly<{
  valid: boolean;
  value: T | null;
  issues: readonly string[];
}>;

export type ResolvedMastery = Readonly<{
  mastery: CharacterMastery | null;
  techniques: readonly ActiveTechnique[];
  issues: readonly string[];
}>;

const CANONICAL_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const CHAMPION_SLUGS = new Set(Object.keys(CHAMPION_MEMBERSHIP));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: string[],
): void {
  const allow = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allow.has(key)) issues.push(`${path} contains unsupported key "${key}".`);
  }
  for (const key of allowed) {
    if (!(key in value)) issues.push(`${path}.${key} is required.`);
  }
}

function plainData(value: unknown, path: string, issues: string[]): void {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value))
  ) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => plainData(entry, `${path}[${index}]`, issues));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      plainData(entry, `${path}.${key}`, issues);
    }
    return;
  }
  issues.push(`${path} must contain only plain declarative data.`);
}

function canonicalString(value: unknown, path: string, issues: string[]): value is string {
  if (typeof value !== "string" || !CANONICAL_ID.test(value)) {
    issues.push(`${path} must be a canonical lowercase id.`);
    return false;
  }
  return true;
}

function nonEmptyString(value: unknown, path: string, issues: string[]): value is string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    issues.push(`${path} must be a trimmed non-empty string.`);
    return false;
  }
  return true;
}

function integerBetween(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
  issues: string[],
): value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    issues.push(`${path} must be a safe integer from ${minimum} to ${maximum}.`);
    return false;
  }
  return true;
}

function stringArray(value: unknown, path: string, issues: string[]): value is readonly string[] {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array.`);
    return false;
  }
  value.forEach((entry, index) => nonEmptyString(entry, `${path}[${index}]`, issues));
  return value.every((entry) => typeof entry === "string");
}

function championSlug(value: unknown, path: string, issues: string[]): value is ChampionSlug {
  if (typeof value !== "string" || !CHAMPION_SLUGS.has(value)) {
    issues.push(`${path} must name an approved Champion.`);
    return false;
  }
  return true;
}

export function currentTechniqueCompatibility(
  slug: ChampionSlug,
): TechniqueCompatibility {
  const champion = CHAMPION_MEMBERSHIP[slug];
  return Object.freeze({
    gameVersion: GAME_MECHANICS_VERSION,
    mechanicsRevision: DEFAULT_MECHANICS_REVISION,
    contentRevision: DEFAULT_CONTENT_REVISION,
    championSlug: slug,
    characterId: champion.characterId,
    skillId: champion.skillId as SkillId,
    techniqueSchemaVersion: TECHNIQUE_SCHEMA_VERSION,
  });
}

function validateCompatibility(
  value: unknown,
  expectedChampion: ChampionSlug | undefined,
  path: string,
  issues: string[],
): void {
  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object.`);
    return;
  }
  exactKeys(value, [
    "gameVersion",
    "mechanicsRevision",
    "contentRevision",
    "championSlug",
    "characterId",
    "skillId",
    "techniqueSchemaVersion",
  ], path, issues);
  const slug = value.championSlug;
  const slugValid = championSlug(slug, `${path}.championSlug`, issues);
  if (!slugValid) return;
  if (expectedChampion && slug !== expectedChampion) {
    issues.push(`${path}.championSlug does not match ${expectedChampion}.`);
  }
  const current = currentTechniqueCompatibility(slug);
  for (const key of [
    "gameVersion",
    "mechanicsRevision",
    "contentRevision",
    "characterId",
    "skillId",
    "techniqueSchemaVersion",
  ] as const) {
    if (value[key] !== current[key]) {
      issues.push(`${path}.${key} is stale or incompatible (expected ${String(current[key])}).`);
    }
  }
}

function validatePredicate(
  value: unknown,
  path: string,
  issues: string[],
): value is TechniquePredicate {
  if (!isPlainObject(value) || typeof value.kind !== "string") {
    issues.push(`${path} must be a declarative predicate object.`);
    return false;
  }
  if (value.kind === "self-in-danger") {
    exactKeys(value, ["kind"], path, issues);
    return true;
  }
  if (value.kind === "opponent-aligned") {
    exactKeys(value, ["kind", "maxTiles", "clearPath"], path, issues);
    integerBetween(value.maxTiles, 1, 16, `${path}.maxTiles`, issues);
    if (value.clearPath !== true) issues.push(`${path}.clearPath must be true.`);
    return true;
  }
  if (value.kind === "opponent-within") {
    exactKeys(value, ["kind", "radius"], path, issues);
    integerBetween(value.radius, 1, 16, `${path}.radius`, issues);
    return true;
  }
  issues.push(`${path}.kind is unsupported: ${String(value.kind)}.`);
  return false;
}

function validateTechniqueCore(
  value: unknown,
  expectedChampion: ChampionSlug | undefined,
  expectedStatus: "active" | "candidate",
  issues: string[],
): value is ActiveTechnique | TechniqueCandidate {
  if (!isPlainObject(value)) {
    issues.push("technique must be an object.");
    return false;
  }
  plainData(value, "technique", issues);
  exactKeys(
    value,
    expectedStatus === "active"
      ? [
          "schemaVersion", "id", "status", "compatibility", "provenance",
          "condition", "action", "score", "promotion",
        ]
      : [
          "schemaVersion", "id", "status", "compatibility", "provenance",
          "condition", "action", "proposedPriority",
        ],
    "technique",
    issues,
  );
  if (value.schemaVersion !== TECHNIQUE_SCHEMA_VERSION) {
    issues.push(`technique.schemaVersion must be ${TECHNIQUE_SCHEMA_VERSION}.`);
  }
  canonicalString(value.id, "technique.id", issues);
  if (value.status !== expectedStatus) issues.push(`technique.status must be ${expectedStatus}.`);
  validateCompatibility(value.compatibility, expectedChampion, "technique.compatibility", issues);

  if (!isPlainObject(value.provenance)) {
    issues.push("technique.provenance must be an object.");
  } else {
    exactKeys(
      value.provenance,
      ["kind", "hypothesisId", "proposedBy", "sourceEventIds"],
      "technique.provenance",
      issues,
    );
    if (
      value.provenance.kind !== "authored-hypothesis"
      && value.provenance.kind !== "mechanical-observation"
    ) issues.push("technique.provenance.kind is unsupported.");
    canonicalString(value.provenance.hypothesisId, "technique.provenance.hypothesisId", issues);
    nonEmptyString(value.provenance.proposedBy, "technique.provenance.proposedBy", issues);
    stringArray(value.provenance.sourceEventIds, "technique.provenance.sourceEventIds", issues);
  }

  if (!isPlainObject(value.condition)) {
    issues.push("technique.condition must be an object.");
  } else {
    exactKeys(value.condition, ["all"], "technique.condition", issues);
    if (!Array.isArray(value.condition.all) || value.condition.all.length === 0) {
      issues.push("technique.condition.all must be a non-empty array.");
    } else {
      value.condition.all.forEach((predicate, index) =>
        validatePredicate(predicate, `technique.condition.all[${index}]`, issues));
    }
  }

  if (!isPlainObject(value.action)) {
    issues.push("technique.action must be an object.");
  } else {
    exactKeys(value.action, ["kind"], "technique.action", issues);
    if (value.action.kind !== "use-skill") issues.push("technique.action.kind is unsupported.");
  }

  if (expectedStatus === "candidate") {
    integerBetween(value.proposedPriority, 0, 10_000, "technique.proposedPriority", issues);
    return true;
  }

  if (!isPlainObject(value.score)) {
    issues.push("technique.score must be an object.");
  } else {
    exactKeys(value.score, [
      "priority", "confidenceBasisPoints", "utilityBasisPoints", "evidenceMatches",
      "evaluationEpoch", "decayPerEpochBasisPoints", "floorBasisPoints",
    ], "technique.score", issues);
    integerBetween(value.score.priority, 0, 10_000, "technique.score.priority", issues);
    integerBetween(value.score.confidenceBasisPoints, 0, 10_000, "technique.score.confidenceBasisPoints", issues);
    integerBetween(value.score.utilityBasisPoints, 0, 10_000, "technique.score.utilityBasisPoints", issues);
    integerBetween(value.score.evidenceMatches, 0, 1_000_000, "technique.score.evidenceMatches", issues);
    integerBetween(value.score.evaluationEpoch, 0, 1_000_000, "technique.score.evaluationEpoch", issues);
    integerBetween(value.score.decayPerEpochBasisPoints, 0, 10_000, "technique.score.decayPerEpochBasisPoints", issues);
    integerBetween(value.score.floorBasisPoints, 0, 10_000, "technique.score.floorBasisPoints", issues);
  }

  if (!isPlainObject(value.promotion)) {
    issues.push("technique.promotion must be an object.");
  } else {
    exactKeys(value.promotion, [
      "campaignId", "seedManifest", "baselineMatches", "candidateMatches",
      "baselineWins", "candidateWins", "winRateDeltaBasisPoints",
      "objectiveDeltaBasisPoints", "candidateOpportunities", "candidateSuccessfulOutcomes",
      "distinctSuccessfulTrajectories", "deterministicReplaysVerified",
      "commandRejections", "safetyRegressions", "promotedBy",
    ], "technique.promotion", issues);
    canonicalString(value.promotion.campaignId, "technique.promotion.campaignId", issues);
    stringArray(value.promotion.seedManifest, "technique.promotion.seedManifest", issues);
    for (const key of [
      "baselineMatches", "candidateMatches", "baselineWins", "candidateWins",
      "commandRejections", "safetyRegressions",
      "candidateOpportunities", "candidateSuccessfulOutcomes", "distinctSuccessfulTrajectories",
    ] as const) integerBetween(value.promotion[key], 0, 1_000_000, `technique.promotion.${key}`, issues);
    integerBetween(
      value.promotion.winRateDeltaBasisPoints,
      -10_000,
      10_000,
      "technique.promotion.winRateDeltaBasisPoints",
      issues,
    );
    integerBetween(
      value.promotion.objectiveDeltaBasisPoints,
      -1_000_000,
      1_000_000,
      "technique.promotion.objectiveDeltaBasisPoints",
      issues,
    );
    if (value.promotion.deterministicReplaysVerified !== true) {
      issues.push("technique.promotion.deterministicReplaysVerified must be true.");
    }
    nonEmptyString(value.promotion.promotedBy, "technique.promotion.promotedBy", issues);
  }
  return true;
}

export function validateActiveTechnique(
  value: unknown,
  expectedChampion?: ChampionSlug,
): ValidationResult<ActiveTechnique> {
  const issues: string[] = [];
  const shaped = validateTechniqueCore(value, expectedChampion, "active", issues);
  return Object.freeze({
    valid: shaped && issues.length === 0,
    value: shaped && issues.length === 0 ? value as ActiveTechnique : null,
    issues: Object.freeze(issues),
  });
}

export function validateTechniqueCandidate(
  value: unknown,
  expectedChampion?: ChampionSlug,
): ValidationResult<TechniqueCandidate> {
  const issues: string[] = [];
  const shaped = validateTechniqueCore(value, expectedChampion, "candidate", issues);
  return Object.freeze({
    valid: shaped && issues.length === 0,
    value: shaped && issues.length === 0 ? value as TechniqueCandidate : null,
    issues: Object.freeze(issues),
  });
}

function validateMastery(
  value: unknown,
  slug: ChampionSlug,
  path: string,
  issues: string[],
): value is CharacterMastery {
  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object.`);
    return false;
  }
  exactKeys(value, [
    "schemaVersion", "knowledgeVersion", "championSlug", "characterId", "skillId",
    "masteryBasisPoints", "authoredKnowledge", "techniques",
  ], path, issues);
  if (value.schemaVersion !== BOT_MASTERY_SCHEMA_VERSION) {
    issues.push(`${path}.schemaVersion must be ${BOT_MASTERY_SCHEMA_VERSION}.`);
  }
  nonEmptyString(value.knowledgeVersion, `${path}.knowledgeVersion`, issues);
  if (value.championSlug !== slug) issues.push(`${path}.championSlug must be ${slug}.`);
  const champion = CHAMPION_MEMBERSHIP[slug];
  if (value.characterId !== champion.characterId) issues.push(`${path}.characterId is incompatible.`);
  if (value.skillId !== champion.skillId) issues.push(`${path}.skillId is incompatible.`);
  integerBetween(value.masteryBasisPoints, 0, 10_000, `${path}.masteryBasisPoints`, issues);
  if (!Array.isArray(value.authoredKnowledge)) {
    issues.push(`${path}.authoredKnowledge must be an array.`);
  } else {
    value.authoredKnowledge.forEach((note, index) => {
      const notePath = `${path}.authoredKnowledge[${index}]`;
      if (!isPlainObject(note)) {
        issues.push(`${notePath} must be an object.`);
        return;
      }
      exactKeys(note, ["id", "author", "hypothesis"], notePath, issues);
      canonicalString(note.id, `${notePath}.id`, issues);
      nonEmptyString(note.author, `${notePath}.author`, issues);
      nonEmptyString(note.hypothesis, `${notePath}.hypothesis`, issues);
    });
  }
  if (!Array.isArray(value.techniques)) {
    issues.push(`${path}.techniques must be an array.`);
  } else {
    const ids = new Set<string>();
    value.techniques.forEach((technique, index) => {
      const result = validateActiveTechnique(technique, slug);
      result.issues.forEach((issue) => issues.push(`${path}.techniques[${index}]: ${issue}`));
      if (result.value) {
        if (ids.has(result.value.id)) issues.push(`${path}.techniques contains duplicate ${result.value.id}.`);
        ids.add(result.value.id);
      }
    });
  }
  return true;
}

export function validateBotModel(value: unknown): ValidationResult<BotModel> {
  const issues: string[] = [];
  if (!isPlainObject(value)) {
    return Object.freeze({ valid: false, value: null, issues: Object.freeze(["model must be an object."]) });
  }
  plainData(value, "model", issues);
  exactKeys(value, ["schemaVersion", "modelVersion", "identity", "mastery"], "model", issues);
  if (value.schemaVersion !== BOT_MASTERY_SCHEMA_VERSION) {
    issues.push(`model.schemaVersion must be ${BOT_MASTERY_SCHEMA_VERSION}.`);
  }
  nonEmptyString(value.modelVersion, "model.modelVersion", issues);
  if (!isPlainObject(value.identity)) {
    issues.push("model.identity must be an object.");
  } else {
    exactKeys(value.identity, ["id", "label", "personality", "preferences"], "model.identity", issues);
    canonicalString(value.identity.id, "model.identity.id", issues);
    nonEmptyString(value.identity.label, "model.identity.label", issues);
    if (!isPlainObject(value.identity.personality)) {
      issues.push("model.identity.personality must be an object.");
    } else {
      exactKeys(value.identity.personality, ["aggression", "patience", "curiosity"], "model.identity.personality", issues);
      for (const key of ["aggression", "patience", "curiosity"] as const) {
        integerBetween(value.identity.personality[key], 0, 1_000, `model.identity.personality.${key}`, issues);
      }
    }
    if (!Array.isArray(value.identity.preferences)) {
      issues.push("model.identity.preferences must be an array.");
    } else {
      const seen = new Set<ChampionSlug>();
      value.identity.preferences.forEach((preference, index) => {
        const path = `model.identity.preferences[${index}]`;
        if (!isPlainObject(preference)) {
          issues.push(`${path} must be an object.`);
          return;
        }
        exactKeys(preference, ["championSlug", "weight"], path, issues);
        if (championSlug(preference.championSlug, `${path}.championSlug`, issues)) {
          if (seen.has(preference.championSlug)) issues.push(`${path}.championSlug is duplicated.`);
          seen.add(preference.championSlug);
        }
        integerBetween(preference.weight, 0, 1_000, `${path}.weight`, issues);
      });
    }
  }
  if (!isPlainObject(value.mastery)) {
    issues.push("model.mastery must be an object.");
  } else {
    for (const [slug, mastery] of Object.entries(value.mastery)) {
      if (!CHAMPION_SLUGS.has(slug)) {
        issues.push(`model.mastery contains unsupported Champion "${slug}".`);
        continue;
      }
      validateMastery(mastery, slug as ChampionSlug, `model.mastery.${slug}`, issues);
    }
  }
  return Object.freeze({
    valid: issues.length === 0,
    value: issues.length === 0 ? value as BotModel : null,
    issues: Object.freeze(issues),
  });
}

/**
 * Runtime-safe projection. Invalid/stale techniques are quarantined while a
 * valid mastery header and authored notes remain observable.
 */
export function resolveValidatedMastery(
  model: BotModel,
  slug: ChampionSlug,
): ResolvedMastery {
  const raw = model.mastery[slug];
  if (!raw) return Object.freeze({ mastery: null, techniques: Object.freeze([]), issues: Object.freeze([]) });
  const headerIssues: string[] = [];
  if (
    raw.schemaVersion !== BOT_MASTERY_SCHEMA_VERSION
    || raw.championSlug !== slug
    || raw.characterId !== CHAMPION_MEMBERSHIP[slug].characterId
    || raw.skillId !== CHAMPION_MEMBERSHIP[slug].skillId
  ) {
    headerIssues.push(`Mastery ${model.identity.id}/${slug} is structurally incompatible.`);
    return Object.freeze({ mastery: null, techniques: Object.freeze([]), issues: Object.freeze(headerIssues) });
  }
  const techniques: ActiveTechnique[] = [];
  for (const technique of raw.techniques) {
    const result = validateActiveTechnique(technique, slug);
    if (result.value) techniques.push(result.value);
    else result.issues.forEach((issue) => headerIssues.push(`${technique.id}: ${issue}`));
  }
  return Object.freeze({
    mastery: raw,
    techniques: Object.freeze(techniques),
    issues: Object.freeze(headerIssues),
  });
}
