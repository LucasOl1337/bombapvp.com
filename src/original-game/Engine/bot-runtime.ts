import type { Direction, PlayerId, PlayerState } from "../Gameplay/types";
import type { BotContext, BotDecision, BotDecisionPolicy } from "./bot-contracts";

const DIRECTIONS: ReadonlySet<Direction> = new Set([
  "up",
  "down",
  "left",
  "right",
]);

const SKILL_ACTIONS = new Set<NonNullable<BotDecision["skillAction"]>>([
  "start",
  "hold",
  "release",
  "none",
]);

const INTENTS = new Set<NonNullable<BotDecision["intent"]>>([
  "remote-detonation",
  "bomb-attack",
  "attack-position",
  "chase-enemy",
]);

type SkillAction = NonNullable<BotDecision["skillAction"]>;
type BotIntent = NonNullable<BotDecision["intent"]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeBotDecision(value: unknown): BotDecision {
  if (!isRecord(value)) {
    return { direction: null, placeBomb: false };
  }

  const direction = typeof value.direction === "string" && DIRECTIONS.has(value.direction as Direction)
    ? value.direction as Direction
    : null;

  const decision: BotDecision = {
    direction,
    placeBomb: value.placeBomb === true,
  };

  if (value.detonate === true) decision.detonate = true;
  if (value.useSkill === true || value.useSkill === false) decision.useSkill = value.useSkill;
  if (value.skillHeld === true || value.skillHeld === false) decision.skillHeld = value.skillHeld;
  const skillAction = value.skillAction;
  if (typeof skillAction === "string" && SKILL_ACTIONS.has(skillAction as SkillAction)) {
    decision.skillAction = skillAction as SkillAction;
  }
  if (Number.isInteger(value.requestId) && (value.requestId as number) >= 0) {
    decision.requestId = value.requestId as number;
  }
  if (Number.isInteger(value.microActionIndex) && (value.microActionIndex as number) >= 0) {
    decision.microActionIndex = value.microActionIndex as number;
  }
  if (value.targetId === 1 || value.targetId === 2 || value.targetId === 3 || value.targetId === 4) {
    decision.targetId = value.targetId;
  }
  const intent = value.intent;
  if (typeof intent === "string" && INTENTS.has(intent as BotIntent)) {
    decision.intent = intent as BotIntent;
  }
  return decision;
}

export interface BotRuntime {
  decide(player: PlayerState, context: BotContext): BotDecision;
  reset(playerId?: PlayerId): void;
}

export type BotRuntimeOptions = Readonly<{
  /**
   * Remote decisions are command states, so repeated attacks become pulses.
   * Local policies keep their historical per-tick behavior unless they opt in.
   */
  edgeTriggerActions?: boolean;
}>;

type PreviousDecision = Readonly<{
  placeBomb: boolean;
  detonate: boolean;
  useSkill: boolean;
  skillAction: SkillAction | null;
}>;

/**
 * Owns decision lifecycle independently from the match host. Movement remains
 * continuous, while attack commands become one-shot pulses per player. This
 * lets local policies and a later remote adapter share the exact same input
 * boundary.
 */
export function createBotRuntime(
  policy: BotDecisionPolicy,
  { edgeTriggerActions = false }: BotRuntimeOptions = {},
): BotRuntime {
  const previousByPlayer = new Map<PlayerId, PreviousDecision>();

  return {
    decide(player, context) {
      const decision = normalizeBotDecision(policy(player, context));
      if (!edgeTriggerActions) {
        return decision;
      }
      const previous = previousByPlayer.get(player.id);
      const isNewSkillAction = decision.useSkill === true
        && (previous?.useSkill !== true || previous.skillAction !== (decision.skillAction ?? null));
      const pulsed: BotDecision = {
        ...decision,
        placeBomb: decision.placeBomb && previous?.placeBomb !== true,
      };
      if (decision.detonate === true && previous?.detonate !== true) {
        pulsed.detonate = true;
      } else {
        delete pulsed.detonate;
      }
      if (isNewSkillAction) {
        pulsed.useSkill = true;
      } else if (decision.useSkill !== undefined) {
        pulsed.useSkill = false;
      }
      previousByPlayer.set(player.id, {
        placeBomb: decision.placeBomb,
        detonate: decision.detonate === true,
        useSkill: decision.useSkill === true,
        skillAction: decision.skillAction ?? null,
      });
      return pulsed;
    },
    reset(playerId) {
      if (playerId === undefined) {
        previousByPlayer.clear();
      } else {
        previousByPlayer.delete(playerId);
      }
    },
  };
}
