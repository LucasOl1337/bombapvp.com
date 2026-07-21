import type {
  FacadeCommandRejection,
  GameCommand,
  GameEvent,
  GameSnapshot,
  MatchConfig,
} from "../contracts.ts";
import {
  createBotMemory,
  createBotPrng,
  driveBot,
  resolveBotProfile,
  type BotMemory,
  type BotPrng,
  type BotProfile,
} from "../bots/index.ts";
import { FILE_BACKED_BOT_MODEL_REPOSITORY } from "../../content/bot-mastery/catalog.ts";
import {
  EXPERIENCE_SCHEMA_VERSION,
  NULL_EXPERIENCE_SINK,
  resolveValidatedMastery,
  selectTechnique,
  validateBotModel,
  validateTechniqueCandidate,
  type BotModel,
  type BotModelRepository,
  type ExperienceSink,
  type RuntimeTechnique,
  type TacticalSituation,
  type TechniqueCandidate,
} from "./bot-mastery/index.ts";
import type { BrowserMatchConfiguration } from "./match-mode.ts";

export type BrowserBotDriver = {
  readonly playerIndex: 0 | 1;
  readonly profile: BotProfile;
  readonly seatId: MatchConfig["seats"][number]["seatId"];
  readonly competitorId: MatchConfig["seats"][number]["competitorId"];
  readonly prng: BotPrng;
  readonly memory: BotMemory;
  readonly championSlug: BrowserMatchConfiguration["players"][number]["championSlug"];
  readonly model: BotModel | null;
  readonly modelVersion: string;
  readonly masteryBasisPoints: number;
  readonly techniques: readonly RuntimeTechnique[];
  readonly compatibilityWarnings: readonly string[];
  readonly experienceSink: ExperienceSink;
  recordExperience: boolean;
  experienceEvents: number;
  experienceSequence: number;
  matchExperienceRecorded: boolean;
  commandRejections: number;
  lastSituation: TacticalSituation | null;
  lastTechniqueId: string | null;
  readonly selectedTechniqueCounts: Record<string, number>;
  decisions: number;
  commands: number;
};

export type BrowserBotDriveReport = Readonly<{
  playerIndex: 0 | 1;
  profileId: BotProfile["id"];
  commands: readonly GameCommand[];
  eligibleTechniqueIds: readonly string[];
  selectedTechniqueId: string | null;
}>;

export type DriveBotImplementation = typeof driveBot;

export type CreateBrowserBotDriverOptions = Readonly<{
  modelRepository?: BotModelRepository;
  experienceSink?: ExperienceSink;
  recordExperience?: boolean;
  /** Candidate data is inert unless a supervised evaluator explicitly injects it here. */
  evaluationCandidates?: Readonly<Partial<Record<0 | 1, readonly TechniqueCandidate[]>>>;
}>;

export function createBrowserBotDrivers(
  configuration: BrowserMatchConfiguration,
  matchConfig: MatchConfig,
  options: CreateBrowserBotDriverOptions = {},
): BrowserBotDriver[] {
  const drivers: BrowserBotDriver[] = [];
  const repository = options.modelRepository ?? FILE_BACKED_BOT_MODEL_REPOSITORY;
  const experienceSink = options.experienceSink ?? NULL_EXPERIENCE_SINK;
  for (const playerIndex of [0, 1] as const) {
    const player = configuration.players[playerIndex];
    if (player.control !== "bot") continue;
    const seat = matchConfig.seats[playerIndex]!;
    const profile = resolveBotProfile(player.profileId);
    const rawModel = repository.get(profile.id);
    const modelValidation = rawModel
      ? validateBotModel(rawModel)
      : Object.freeze({ valid: false, value: null, issues: Object.freeze([`Missing bot model: ${profile.id}.`]) });
    const model = modelValidation.value;
    const resolved = model
      ? resolveValidatedMastery(model, player.championSlug)
      : Object.freeze({ mastery: null, techniques: Object.freeze([]), issues: Object.freeze([]) });
    const warnings = [...modelValidation.issues, ...resolved.issues];
    const candidates: TechniqueCandidate[] = [];
    for (const candidate of options.evaluationCandidates?.[playerIndex] ?? []) {
      const validation = validateTechniqueCandidate(candidate, player.championSlug);
      if (validation.value) candidates.push(validation.value);
      else validation.issues.forEach((issue) => warnings.push(`Evaluation candidate ${candidate.id}: ${issue}`));
    }
    const techniques: readonly RuntimeTechnique[] = Object.freeze([
      ...resolved.techniques,
      ...candidates,
    ]);
    drivers.push({
      playerIndex,
      profile,
      seatId: seat.seatId,
      competitorId: seat.competitorId,
      prng: createBotPrng(`${matchConfig.seed}|seat:${seat.seatId}|profile:${profile.id}`),
      memory: createBotMemory(),
      championSlug: player.championSlug,
      model,
      modelVersion: model?.modelVersion ?? "legacy-profile",
      masteryBasisPoints: resolved.mastery?.masteryBasisPoints ?? 0,
      techniques,
      compatibilityWarnings: Object.freeze(warnings),
      experienceSink,
      recordExperience: options.recordExperience ?? false,
      experienceEvents: 0,
      experienceSequence: 0,
      matchExperienceRecorded: false,
      commandRejections: 0,
      lastSituation: null,
      lastTechniqueId: null,
      selectedTechniqueCounts: {},
      decisions: 0,
      commands: 0,
    });
  }
  return drivers;
}

/**
 * Ask every configured bot for ordinary GameCommands. Dispatch stays with the
 * browser/facade so diagnostics never receive a simulation mutation channel.
 */
export function driveBrowserBotsForTick(
  snapshot: GameSnapshot,
  drivers: readonly BrowserBotDriver[],
  implementation: DriveBotImplementation = driveBot,
): readonly BrowserBotDriveReport[] {
  if (snapshot.phase !== "playing" && snapshot.phase !== "sudden-death") {
    return Object.freeze([]);
  }

  return Object.freeze(drivers.map((driver) => {
    const baseCommands = implementation(
      snapshot,
      driver.seatId,
      driver.competitorId,
      driver.prng,
      driver.memory,
      driver.profile,
    );
    const selection = selectTechnique(
      snapshot,
      driver.competitorId,
      driver.championSlug,
      driver.techniques,
      baseCommands,
    );
    const commands = Object.freeze([
      ...baseCommands,
      ...(selection?.additionalCommands ?? []),
    ]);
    driver.decisions += 1;
    driver.commands += commands.length;
    driver.lastSituation = selection?.situation ?? null;
    driver.lastTechniqueId = selection?.selectedTechniqueId ?? null;
    if (selection?.selectedTechniqueId) {
      driver.selectedTechniqueCounts[selection.selectedTechniqueId] =
        (driver.selectedTechniqueCounts[selection.selectedTechniqueId] ?? 0) + 1;
    }
    if (driver.recordExperience && selection) {
      const sequence = driver.experienceSequence;
      driver.experienceSequence += 1;
      driver.experienceSink.append(Object.freeze({
        schemaVersion: EXPERIENCE_SCHEMA_VERSION,
        eventId: `${snapshot.config.seed}|${driver.seatId}|${snapshot.revision}|decision`,
        sequence,
        type: "bot-decision-observed",
        match: Object.freeze({
          seed: snapshot.config.seed,
          gameVersion: snapshot.version,
          mechanicsRevision: snapshot.config.mechanicsRevision,
          contentRevision: snapshot.config.contentRevision,
        }),
        actor: Object.freeze({
          botId: driver.profile.id,
          modelVersion: driver.modelVersion,
          championSlug: driver.championSlug,
          competitorId: driver.competitorId,
        }),
        situation: selection.situation,
        eligibleTechniqueIds: selection.eligibleTechniqueIds,
        selectedTechniqueId: selection.selectedTechniqueId,
        commands,
      }));
      driver.experienceEvents += 1;
    }
    return Object.freeze({
      playerIndex: driver.playerIndex,
      profileId: driver.profile.id,
      commands,
      eligibleTechniqueIds: selection?.eligibleTechniqueIds ?? Object.freeze([]),
      selectedTechniqueId: selection?.selectedTechniqueId ?? null,
    });
  }));
}

export function setBrowserBotExperienceRecording(
  drivers: readonly BrowserBotDriver[],
  enabled: boolean,
): void {
  for (const driver of drivers) driver.recordExperience = enabled;
}

/** Record post-tick diagnostics/outcome without feeding them back into decisions. */
export function recordBrowserBotTickOutcome(
  snapshot: GameSnapshot,
  drivers: readonly BrowserBotDriver[],
  events: readonly GameEvent[],
  rejections: readonly FacadeCommandRejection[],
): void {
  for (const driver of drivers) {
    driver.commandRejections += rejections.filter(({ seatId }) => seatId === driver.seatId).length;
  }
  if (!events.some((event) => event.type === "match-ended")) return;
  for (const driver of drivers) {
    if (!driver.recordExperience || driver.matchExperienceRecorded) continue;
    const sequence = driver.experienceSequence;
    driver.experienceSequence += 1;
    const wins = snapshot.scores.find(
      ({ competitorId }) => competitorId === driver.competitorId,
    )?.wins ?? 0;
    driver.experienceSink.append(Object.freeze({
      schemaVersion: EXPERIENCE_SCHEMA_VERSION,
      eventId: `${snapshot.config.seed}|${driver.seatId}|${snapshot.revision}|match`,
      sequence,
      type: "bot-match-completed",
      match: Object.freeze({
        seed: snapshot.config.seed,
        gameVersion: snapshot.version,
        mechanicsRevision: snapshot.config.mechanicsRevision,
        contentRevision: snapshot.config.contentRevision,
        finalRevision: snapshot.revision,
      }),
      actor: Object.freeze({
        botId: driver.profile.id,
        modelVersion: driver.modelVersion,
        championSlug: driver.championSlug,
        competitorId: driver.competitorId,
      }),
      outcome: Object.freeze({
        won: snapshot.matchWinner === driver.competitorId,
        winnerId: snapshot.matchWinner,
        wins,
        decisions: driver.decisions,
        commands: driver.commands,
        selectedTechniqueCounts: Object.freeze({ ...driver.selectedTechniqueCounts }),
        commandRejections: driver.commandRejections,
      }),
    }));
    driver.experienceEvents += 1;
    driver.matchExperienceRecorded = true;
  }
}

export function browserBotDriverForPlayer(
  drivers: readonly BrowserBotDriver[],
  playerIndex: 0 | 1,
): BrowserBotDriver | null {
  return drivers.find((driver) => driver.playerIndex === playerIndex) ?? null;
}
