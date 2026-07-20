import { listChampionMembership } from "../../../Champions/membership";
import { DEFAULT_ARENA_THEME_ID, getArenaThemeById } from "../../original-game/Arenas/arena-theme-library";
import type { DirectionalSprites, GameAssets } from "../../original-game/Engine/assets";

const SERVER_ROSTER = Object.freeze(
  [...listChampionMembership()]
    .sort((left, right) => left.rosterOrder - right.rosterOrder)
    .map(({ characterId, name, rosterOrder, defaultSlot }) => Object.freeze({
      id: characterId,
      name,
      order: rosterOrder,
      ...(defaultSlot === undefined ? {} : { defaultSlot }),
    })),
);

function emptyFrames() {
  return { up: [], down: [], left: [], right: [] };
}

function emptyDirectionalSprites(): DirectionalSprites {
  return {
    up: null,
    down: null,
    left: null,
    right: null,
    idle: emptyFrames(),
    walk: emptyFrames(),
    run: emptyFrames(),
    cast: emptyFrames(),
    attack: emptyFrames(),
    death: emptyFrames(),
  };
}

/** Logical-only assets: no Image, DOM load, audio decode or visual source URL. */
export function createServerGameAssets(): GameAssets {
  const sprites = emptyDirectionalSprites();
  const theme = getArenaThemeById(DEFAULT_ARENA_THEME_ID);
  if (!theme) throw new Error("server_arena_theme_missing");
  return {
    players: { 1: sprites, 2: sprites, 3: sprites, 4: sprites },
    characterRoster: SERVER_ROSTER.map((character, selectionIndex) => ({
      ...character,
      selectionIndex,
      size: null,
      sprites,
    })),
    characterSpriteLoader: async () => sprites,
    arenaTheme: theme,
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null, crateBreakFrames: [] },
    effects: { speedSparkTrail: null },
    ui: { victoryEmblem: null, stalemateEmblem: null },
    hud: {
      panelLocal: null,
      panelRival: null,
      panelCenter: null,
      chipUlt: null,
      iconBomb: null,
      iconFlame: null,
      iconSpeed: null,
    },
    powerUps: {},
  };
}

export function getServerRosterIndex(characterId: string): number | null {
  const index = SERVER_ROSTER.findIndex((character) => character.id === characterId);
  return index < 0 ? null : index;
}
