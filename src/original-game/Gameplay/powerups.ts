import {
  BOMB_FUSE_MS,
  KEY_BINDINGS,
  MAX_BOMB_PASS_LEVEL,
  MAX_BOMBS,
  MAX_KICK_LEVEL,
  MAX_RANGE,
  MAX_SHIELD_CHARGES,
  MAX_SPEED_LEVEL,
} from "../PersonalConfig/config";
import type { MenuPlayerId, PlayerState, PowerUpType } from "./types";
import { deepFreeze } from "../../shared/deep-freeze";
import type { GameAssetId } from "../../../game-assets/index.ts";

export type SkillPowerUpType = PowerUpType;
export type PowerUpLevelField =
  | "maxBombs"
  | "flameRange"
  | "speedLevel"
  | "remoteLevel"
  | "shieldCharges"
  | "bombPassLevel"
  | "kickLevel"
  | "shortFuseLevel";
const MAX_SHORT_FUSE_LEVEL = 2;
const SHORT_FUSE_STEP_MS = 400;
const MIN_SHORT_FUSE_MS = 1_200;

export interface PowerUpDefinition {
  readonly type: PowerUpType;
  readonly label: string;
  readonly shortLabel: string;
  readonly tint: string;
  readonly levelField: PowerUpLevelField;
  readonly maxLevel: number;
  readonly drop: Readonly<{
    poolSlots: readonly number[];
    demolitionComboEligible: boolean;
  }>;
  readonly asset: Readonly<{
    id: GameAssetId;
  }>;
}

const POWER_UP_DEFINITIONS: Readonly<Record<PowerUpType, PowerUpDefinition>> = deepFreeze({
  "bomb-up": {
    type: "bomb-up",
    label: "Bomb Capacity",
    shortLabel: "B",
    tint: "#f4d35e",
    levelField: "maxBombs",
    maxLevel: MAX_BOMBS,
    drop: {
      poolSlots: [3, 4, 13, 16, 17],
      demolitionComboEligible: true,
    },
    asset: {
      id: "gameplay.power-up.bomb.icon",
    },
  },
  "flame-up": {
    type: "flame-up",
    label: "Flame Range",
    shortLabel: "F",
    tint: "#ff7d66",
    levelField: "flameRange",
    maxLevel: MAX_RANGE,
    drop: {
      poolSlots: [5, 6, 18, 19],
      demolitionComboEligible: true,
    },
    asset: {
      id: "gameplay.power-up.flame.icon",
    },
  },
  "speed-up": {
    type: "speed-up",
    label: "Move Speed",
    shortLabel: "S",
    tint: "#7cffb2",
    levelField: "speedLevel",
    maxLevel: MAX_SPEED_LEVEL,
    drop: {
      poolSlots: [0, 1, 12, 14, 15],
      demolitionComboEligible: true,
    },
    asset: {
      id: "gameplay.power-up.speed.icon",
    },
  },
  "remote-up": {
    type: "remote-up",
    label: "Remote Detonation",
    shortLabel: "RD",
    tint: "#8cd6ff",
    levelField: "remoteLevel",
    maxLevel: 1,
    drop: {
      poolSlots: [2, 7],
      demolitionComboEligible: false,
    },
    asset: {
      id: "gameplay.power-up.remote.icon",
    },
  },
  "shield-up": {
    type: "shield-up",
    label: "Shield Charge",
    shortLabel: "SH",
    tint: "#bba7ff",
    levelField: "shieldCharges",
    maxLevel: MAX_SHIELD_CHARGES,
    drop: {
      poolSlots: [8, 20],
      demolitionComboEligible: true,
    },
    asset: {
      id: "gameplay.power-up.shield.icon",
    },
  },
  "bomb-pass-up": {
    type: "bomb-pass-up",
    label: "Bomb Pass",
    shortLabel: "BP",
    tint: "#f7a8ff",
    levelField: "bombPassLevel",
    maxLevel: MAX_BOMB_PASS_LEVEL,
    drop: {
      poolSlots: [22],
      demolitionComboEligible: false,
    },
    asset: {
      id: "gameplay.power-up.bomb-pass.icon",
    },
  },
  "kick-up": {
    type: "kick-up",
    label: "Bomb Kick",
    shortLabel: "BK",
    tint: "#ffbc73",
    levelField: "kickLevel",
    maxLevel: MAX_KICK_LEVEL,
    drop: {
      poolSlots: [10, 11, 23],
      demolitionComboEligible: false,
    },
    asset: {
      id: "gameplay.power-up.kick.icon",
    },
  },
  "short-fuse-up": {
    type: "short-fuse-up",
    label: "Short Fuse",
    shortLabel: "SF",
    tint: "#ff5eea",
    levelField: "shortFuseLevel",
    maxLevel: MAX_SHORT_FUSE_LEVEL,
    drop: {
      poolSlots: [9, 21],
      demolitionComboEligible: true,
    },
    asset: {
      id: "gameplay.power-up.short-fuse.icon",
    },
  },
});

export const POWER_UP_TYPES: readonly PowerUpType[] = deepFreeze([
  "bomb-up",
  "flame-up",
  "speed-up",
  "remote-up",
  "shield-up",
  "bomb-pass-up",
  "kick-up",
  "short-fuse-up",
]);

export const SKILL_POWER_UP_TYPES: readonly SkillPowerUpType[] = POWER_UP_TYPES;

const CODE_TO_LABEL: Record<string, string> = {
  ArrowUp: "UP",
  ArrowDown: "DN",
  ArrowLeft: "LT",
  ArrowRight: "RT",
  Space: "SPC",
  Enter: "ENT",
  Escape: "ESC",
};

export function getPowerUpDefinition(type: PowerUpType): PowerUpDefinition {
  return POWER_UP_DEFINITIONS[type];
}

export function listPowerUpDefinitions(): readonly PowerUpDefinition[] {
  return POWER_UP_TYPES.map(getPowerUpDefinition);
}

export function getPowerUpDropPool(): readonly PowerUpType[] {
  const slots = new Map<number, PowerUpType>();
  for (const definition of listPowerUpDefinitions()) {
    for (const slot of definition.drop.poolSlots) {
      slots.set(slot, definition.type);
    }
  }

  return [...slots.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, type]) => type);
}

export function getDemolitionComboDropTypes(): readonly PowerUpType[] {
  return listPowerUpDefinitions()
    .filter((definition) => definition.drop.demolitionComboEligible)
    .map((definition) => definition.type);
}

export function getPowerUpLevel(player: PlayerState, type: PowerUpType): number {
  return player[getPowerUpDefinition(type).levelField];
}

export function isPowerUpMaxed(player: PlayerState, type: PowerUpType): boolean {
  return getPowerUpLevel(player, type) >= getPowerUpDefinition(type).maxLevel;
}

export function applyPowerUpToPlayer(player: PlayerState, type: PowerUpType): void {
  const definition = getPowerUpDefinition(type);
  const levelField = definition.levelField;
  player[levelField] = Math.min(definition.maxLevel, player[levelField] + 1);
}

export function getPowerUpPriorityScore(player: PlayerState, type: PowerUpType): number {
  if (type === "bomb-up") {
    if (player.maxBombs >= MAX_BOMBS) {
      return 0;
    }
    const levelsAfterFirst = Math.max(0, player.maxBombs - 1);
    return 300 + 160 / (2 ** levelsAfterFirst);
  }
  if (type === "flame-up") {
    if (player.flameRange >= MAX_RANGE) {
      return 0;
    }
    if (player.flameRange === 1) {
      return 460;
    }
    if (player.flameRange === 2) {
      return 340;
    }
    return 260 + 40 / 2 ** (player.flameRange - 3);
  }
  if (type === "remote-up") {
    if (player.remoteLevel >= 1) {
      return 0;
    }
    // O controle de detonação vence por um ponto o primeiro Short Fuse: oferece a mesma pressão
    // ofensiva sem reduzir permanentemente a janela de fuga do bot.
    return 261;
  }
  if (type === "shield-up") {
    if (player.shieldCharges >= MAX_SHIELD_CHARGES) {
      return 0;
    }
    // A bot sem proteção deve priorizar a sobrevivência antes de upgrades ofensivos.
    if (player.shieldCharges === 0) {
      return 500;
    }
    // Após a primeira carga, a segunda ainda preserva metade do valor inicial.
    return 250;
  }
  if (type === "bomb-pass-up") {
    if (player.bombPassLevel >= MAX_BOMB_PASS_LEVEL) {
      return 0;
    }
    return 240;
  }
  if (type === "kick-up") {
    if (player.kickLevel >= MAX_KICK_LEVEL) {
      return 0;
    }
    // Antes de obter passagem por bombas, o chute vence Bomb Pass pela margem mínima de um ponto.
    return player.bombPassLevel === 0 ? 241 : 180;
  }
  if (type === "short-fuse-up") {
    if (player.shortFuseLevel >= MAX_SHORT_FUSE_LEVEL) {
      return 0;
    }
    return player.shortFuseLevel === 0 ? 260 : 150;
  }
  if (player.speedLevel >= MAX_SPEED_LEVEL) {
    return 0;
  }
  if (player.speedLevel === 0) {
    return 461;
  }
  // Depois do ganho inicial, cada nível adicional retém metade do bônus estratégico anterior.
  return 120 + 120 / 2 ** (player.speedLevel - 1);
}

export function getBombFuseMsForPlayer(player: PlayerState): number {
  return Math.max(
    MIN_SHORT_FUSE_MS,
    BOMB_FUSE_MS - player.shortFuseLevel * SHORT_FUSE_STEP_MS,
  );
}

export function formatBombFuseSeconds(player: PlayerState): string {
  return `${(getBombFuseMsForPlayer(player) / 1000).toFixed(2)}s`;
}

export function formatControlKey(code: string): string {
  if (code.startsWith("Key")) {
    return code.slice(3).toUpperCase();
  }
  if (code.startsWith("Digit")) {
    return code.slice(5);
  }
  return CODE_TO_LABEL[code] ?? code.toUpperCase();
}

export function getDetonateKeyLabel(playerId: MenuPlayerId): string {
  return formatControlKey(KEY_BINDINGS[playerId].detonate);
}
