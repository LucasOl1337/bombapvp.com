import type {
  CompetitorId,
  GameCommand,
  GameSnapshot,
  SkillId,
  TileCoord,
} from "../../contracts.ts";
import type {
  ChampionSlug,
  CharacterId,
} from "../../../../Champions/membership.ts";

export const BOT_MASTERY_SCHEMA_VERSION = 1 as const;
export const TECHNIQUE_SCHEMA_VERSION = 1 as const;
export const EXPERIENCE_SCHEMA_VERSION = 1 as const;

export type BotPersonality = Readonly<{
  aggression: number;
  patience: number;
  curiosity: number;
}>;

export type ChampionPreference = Readonly<{
  championSlug: ChampionSlug;
  weight: number;
}>;

export type BotIdentity = Readonly<{
  id: string;
  label: string;
  personality: BotPersonality;
  preferences: readonly ChampionPreference[];
}>;

export type AuthoredKnowledge = Readonly<{
  id: string;
  author: string;
  hypothesis: string;
}>;

export type TechniquePredicate =
  | Readonly<{ kind: "self-in-danger" }>
  | Readonly<{
      kind: "opponent-aligned";
      maxTiles: number;
      clearPath: true;
    }>
  | Readonly<{
      kind: "opponent-within";
      radius: number;
    }>;

export type TechniqueCondition = Readonly<{
  all: readonly TechniquePredicate[];
}>;

export type TechniqueAction = Readonly<{
  kind: "use-skill";
}>;

export type TechniqueCompatibility = Readonly<{
  gameVersion: string;
  mechanicsRevision: string;
  contentRevision: string;
  championSlug: ChampionSlug;
  characterId: CharacterId;
  skillId: SkillId;
  techniqueSchemaVersion: typeof TECHNIQUE_SCHEMA_VERSION;
}>;

export type TechniqueProvenance = Readonly<{
  kind: "authored-hypothesis" | "mechanical-observation";
  hypothesisId: string;
  proposedBy: string;
  sourceEventIds: readonly string[];
}>;

export type TechniqueScore = Readonly<{
  priority: number;
  confidenceBasisPoints: number;
  utilityBasisPoints: number;
  evidenceMatches: number;
  evaluationEpoch: number;
  decayPerEpochBasisPoints: number;
  floorBasisPoints: number;
}>;

export type TechniquePromotionEvidence = Readonly<{
  campaignId: string;
  seedManifest: readonly string[];
  baselineMatches: number;
  candidateMatches: number;
  baselineWins: number;
  candidateWins: number;
  winRateDeltaBasisPoints: number;
  objectiveDeltaBasisPoints: number;
  candidateOpportunities: number;
  candidateSuccessfulOutcomes: number;
  distinctSuccessfulTrajectories: number;
  deterministicReplaysVerified: boolean;
  commandRejections: number;
  safetyRegressions: number;
  promotedBy: string;
}>;

export type ActiveTechnique = Readonly<{
  schemaVersion: typeof TECHNIQUE_SCHEMA_VERSION;
  id: string;
  status: "active";
  compatibility: TechniqueCompatibility;
  provenance: TechniqueProvenance;
  condition: TechniqueCondition;
  action: TechniqueAction;
  score: TechniqueScore;
  promotion: TechniquePromotionEvidence;
}>;

export type TechniqueCandidate = Readonly<{
  schemaVersion: typeof TECHNIQUE_SCHEMA_VERSION;
  id: string;
  status: "candidate";
  compatibility: TechniqueCompatibility;
  provenance: TechniqueProvenance;
  condition: TechniqueCondition;
  action: TechniqueAction;
  proposedPriority: number;
}>;

export type CharacterMastery = Readonly<{
  schemaVersion: typeof BOT_MASTERY_SCHEMA_VERSION;
  knowledgeVersion: string;
  championSlug: ChampionSlug;
  characterId: CharacterId;
  skillId: SkillId;
  masteryBasisPoints: number;
  authoredKnowledge: readonly AuthoredKnowledge[];
  techniques: readonly ActiveTechnique[];
}>;

export type BotModel = Readonly<{
  schemaVersion: typeof BOT_MASTERY_SCHEMA_VERSION;
  modelVersion: string;
  identity: BotIdentity;
  mastery: Readonly<Partial<Record<ChampionSlug, CharacterMastery>>>;
}>;

export type BotModelRepository = Readonly<{
  get(botId: string): BotModel | null;
}>;

export type TacticalSituation = Readonly<{
  phase: GameSnapshot["phase"];
  revision: number;
  selfTile: TileCoord;
  selfInDanger: boolean;
  nearestOpponentDistance: number | null;
  alignedOpponentDistance: number | null;
  skillPhase: "idle" | "channeling" | "cooldown" | "unassigned";
}>;

export type TechniqueSelection = Readonly<{
  situation: TacticalSituation;
  eligibleTechniqueIds: readonly string[];
  selectedTechniqueId: string | null;
  additionalCommands: readonly GameCommand[];
}>;

export type BotDecisionExperienceEvent = Readonly<{
  schemaVersion: typeof EXPERIENCE_SCHEMA_VERSION;
  eventId: string;
  sequence: number;
  type: "bot-decision-observed";
  match: Readonly<{
    seed: string;
    gameVersion: string;
    mechanicsRevision: string;
    contentRevision: string;
  }>;
  actor: Readonly<{
    botId: string;
    modelVersion: string;
    championSlug: ChampionSlug;
    competitorId: CompetitorId;
  }>;
  situation: TacticalSituation;
  eligibleTechniqueIds: readonly string[];
  selectedTechniqueId: string | null;
  commands: readonly GameCommand[];
}>;

export type BotMatchExperienceEvent = Readonly<{
  schemaVersion: typeof EXPERIENCE_SCHEMA_VERSION;
  eventId: string;
  sequence: number;
  type: "bot-match-completed";
  match: Readonly<{
    seed: string;
    gameVersion: string;
    mechanicsRevision: string;
    contentRevision: string;
    finalRevision: number;
  }>;
  actor: Readonly<{
    botId: string;
    modelVersion: string;
    championSlug: ChampionSlug;
    competitorId: CompetitorId;
  }>;
  outcome: Readonly<{
    won: boolean;
    winnerId: CompetitorId | null;
    wins: number;
    decisions: number;
    commands: number;
    selectedTechniqueCounts: Readonly<Record<string, number>>;
    commandRejections: number;
  }>;
}>;

export type BotExperienceEvent = BotDecisionExperienceEvent | BotMatchExperienceEvent;

export type ExperienceSink = Readonly<{
  append(event: BotExperienceEvent): void;
}>;

export type TechniqueEvaluationSummary = Readonly<{
  campaignId: string;
  candidateId: string;
  seedManifest: readonly string[];
  baselineMatches: number;
  candidateMatches: number;
  baselineWins: number;
  candidateWins: number;
  baselineObjectivePoints: number;
  candidateObjectivePoints: number;
  candidateOpportunities: number;
  candidateSuccessfulOutcomes: number;
  distinctSuccessfulTrajectories: number;
  deterministicReplaysVerified: boolean;
  commandRejections: number;
  safetyRegressions: number;
}>;

export type PromotionGate = Readonly<{
  minimumMatches: number;
  minimumWinRateDeltaBasisPoints: number;
  minimumObjectiveDeltaBasisPoints: number;
  minimumCandidateObjectiveBasisPoints: number;
  minimumCandidateSuccessfulOutcomes: number;
  minimumDistinctSuccessfulTrajectories: number;
  maximumWinRateRegressionBasisPoints: number;
  maximumSafetyRegressions: number;
}>;

export type TechniquePortfolioEntry = Readonly<{
  candidate: TechniqueCandidate;
  evaluation: TechniqueEvaluationSummary;
  promotion: PromotionDecision;
}>;

export type TechniquePortfolioDecision = Readonly<{
  candidateId: string;
  accepted: boolean;
  reasons: readonly string[];
  technique: ActiveTechnique | null;
}>;

export type TechniqueCurationReview = Readonly<{
  candidateId: string;
  reviewer: string;
  approved: boolean;
  rationale: string;
}>;

export type CuratedTechniqueDecision = TechniquePortfolioDecision & Readonly<{
  reviewer: string;
}>;

export type PromotionDecision =
  | Readonly<{
      accepted: true;
      reasons: readonly string[];
      technique: ActiveTechnique;
    }>
  | Readonly<{
      accepted: false;
      reasons: readonly string[];
      technique: null;
    }>;
