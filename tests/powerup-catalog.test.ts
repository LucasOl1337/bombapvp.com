import { describe, expect, it } from "vitest";

import {
  getDemolitionComboDropTypes,
  getPowerUpDefinition,
  listPowerUpDefinitions,
  POWER_UP_TYPES,
} from "../src/original-game/Gameplay/powerups.ts";

describe("power-up catalog", () => {
  it("exposes a portable power-up definition through its stable ID", () => {
    expect(getPowerUpDefinition("bomb-up")).toEqual({
      type: "bomb-up",
      label: "Bomb Capacity",
      shortLabel: "B",
      tint: "#f4d35e",
      levelField: "maxBombs",
      maxLevel: 5,
      drop: {
        poolSlots: [3, 4, 13, 16, 17],
        demolitionComboEligible: true,
      },
      asset: {
        id: "gameplay.power-up.bomb.icon",
      },
    });
  });

  it("lists every portable definition in canonical order", () => {
    expect(listPowerUpDefinitions()).toEqual([
      {
        type: "bomb-up",
        label: "Bomb Capacity",
        shortLabel: "B",
        tint: "#f4d35e",
        levelField: "maxBombs",
        maxLevel: 5,
        drop: { poolSlots: [3, 4, 13, 16, 17], demolitionComboEligible: true },
        asset: { id: "gameplay.power-up.bomb.icon" },
      },
      {
        type: "flame-up",
        label: "Flame Range",
        shortLabel: "F",
        tint: "#ff7d66",
        levelField: "flameRange",
        maxLevel: 5,
        drop: { poolSlots: [5, 6, 18, 19], demolitionComboEligible: true },
        asset: { id: "gameplay.power-up.flame.icon" },
      },
      {
        type: "speed-up",
        label: "Move Speed",
        shortLabel: "S",
        tint: "#7cffb2",
        levelField: "speedLevel",
        maxLevel: 4,
        drop: { poolSlots: [0, 1, 12, 14, 15], demolitionComboEligible: true },
        asset: { id: "gameplay.power-up.speed.icon" },
      },
      {
        type: "remote-up",
        label: "Remote Detonation",
        shortLabel: "RD",
        tint: "#8cd6ff",
        levelField: "remoteLevel",
        maxLevel: 1,
        drop: { poolSlots: [2, 7], demolitionComboEligible: false },
        asset: { id: "gameplay.power-up.remote.icon" },
      },
      {
        type: "shield-up",
        label: "Shield Charge",
        shortLabel: "SH",
        tint: "#bba7ff",
        levelField: "shieldCharges",
        maxLevel: 2,
        drop: { poolSlots: [8, 20], demolitionComboEligible: true },
        asset: { id: "gameplay.power-up.shield.icon" },
      },
      {
        type: "bomb-pass-up",
        label: "Bomb Pass",
        shortLabel: "BP",
        tint: "#f7a8ff",
        levelField: "bombPassLevel",
        maxLevel: 1,
        drop: { poolSlots: [22], demolitionComboEligible: false },
        asset: { id: "gameplay.power-up.bomb-pass.icon" },
      },
      {
        type: "kick-up",
        label: "Bomb Kick",
        shortLabel: "BK",
        tint: "#ffbc73",
        levelField: "kickLevel",
        maxLevel: 1,
        drop: { poolSlots: [10, 11, 23], demolitionComboEligible: false },
        asset: { id: "gameplay.power-up.kick.icon" },
      },
      {
        type: "short-fuse-up",
        label: "Short Fuse",
        shortLabel: "SF",
        tint: "#ff5eea",
        levelField: "shortFuseLevel",
        maxLevel: 2,
        drop: { poolSlots: [9, 21], demolitionComboEligible: true },
        asset: { id: "gameplay.power-up.short-fuse.icon" },
      },
    ]);
  });

  it("projeta o pool especial sem vazar uma segunda lista para o engine", () => {
    expect(getDemolitionComboDropTypes()).toEqual([
      "bomb-up",
      "flame-up",
      "speed-up",
      "shield-up",
      "short-fuse-up",
    ]);
  });

  it("protege regras e slots canonicos contra mutacao por consumidores", () => {
    const definition = getPowerUpDefinition("bomb-up");
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.drop)).toBe(true);
    expect(Object.isFrozen(definition.drop.poolSlots)).toBe(true);
    expect(Object.isFrozen(POWER_UP_TYPES)).toBe(true);
    expect(() => (definition.drop.poolSlots as number[]).push(99)).toThrow(TypeError);
    expect(getPowerUpDefinition("bomb-up").drop.poolSlots).toEqual([3, 4, 13, 16, 17]);
  });
});
