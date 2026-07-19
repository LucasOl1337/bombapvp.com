import type { Direction, PlayerId, PowerUpType } from "../Gameplay/types";
import { assetUrl } from "./asset-url";
import type { ArenaThemeDefinition } from "../Arenas/arena-theme-library";
import { getArenaThemeById, resolveArenaTheme } from "../Arenas/arena-theme-library";
import { listCharacterDefinitions } from "../../../Champions";
import type { ChampionAssets } from "../../../Champions/assets";
import { getChampionAssets } from "../../../Champions/assets-catalog";
import { listPowerUpDefinitions } from "../Gameplay/powerups";
import { resolveGameAsset } from "../../../game-assets";

export interface DirectionalSprites {
  up: HTMLImageElement | null;
  down: HTMLImageElement | null;
  left: HTMLImageElement | null;
  right: HTMLImageElement | null;
  idle: Record<Direction, HTMLImageElement[]>;
  walk: Record<Direction, HTMLImageElement[]>;
  run: Record<Direction, HTMLImageElement[]>;
  cast: Record<Direction, HTMLImageElement[]>;
  attack: Record<Direction, HTMLImageElement[]>;
  death: Record<Direction, HTMLImageElement[]>;
}

export interface CharacterRosterEntry {
  id: string;
  name: string;
  size: Readonly<{ width: number; height: number }> | null;
  selectionIndex?: number;
  assets?: ChampionAssets;
  sprites?: DirectionalSprites;
  pinned?: boolean;
  defaultSlot?: PlayerId;
  order?: number;
}

export interface GameAssets {
  players: Partial<Record<PlayerId, DirectionalSprites>>;
  characterRoster?: CharacterRosterEntry[];
  characterSpriteLoader: (entry: CharacterRosterEntry) => Promise<DirectionalSprites>;
  arenaTheme: ArenaThemeDefinition;
  floor: {
    base: HTMLImageElement | null;
    /** Optional checker variant of base (loaded when theme provides baseAlt). */
    baseAlt?: HTMLImageElement | null;
    lane: HTMLImageElement | null;
    spawn: HTMLImageElement | null;
    /** Optional wrap-portal floor (open dashed ring). */
    portal?: HTMLImageElement | null;
  };
  props: {
    wall: HTMLImageElement | null;
    /** Optional second wall for checkerboard masonry variation. */
    wallAlt?: HTMLImageElement | null;
    crate: HTMLImageElement | null;
    /** Optional second crate for checkerboard prop variation. */
    crateAlt?: HTMLImageElement | null;
    crateBreakFrames?: HTMLImageElement[];
    bomb: HTMLImageElement | null;
    flame: HTMLImageElement | null;
    /** Optional multi-frame bomb explosion sheet. */
    flameAnimSheet?: HTMLImageElement | null;
  };
  effects?: {
    speedSparkTrail: HTMLImageElement | null;
  };
  ui?: {
    victoryEmblem: HTMLImageElement | null;
    stalemateEmblem: HTMLImageElement | null;
  };
  /** Match HUD chrome + power chips (launcher night/ember kit). */
  hud?: {
    panelLocal: HTMLImageElement | null;
    panelRival: HTMLImageElement | null;
    panelCenter: HTMLImageElement | null;
    chipUlt: HTMLImageElement | null;
    iconBomb: HTMLImageElement | null;
    iconFlame: HTMLImageElement | null;
    iconSpeed: HTMLImageElement | null;
  };
  powerUps: Partial<Record<PowerUpType, HTMLImageElement | null>>;
}

function createEmptyDirectionalFrameSet(): Record<Direction, HTMLImageElement[]> {
  return { up: [], down: [], left: [], right: [] };
}

function createEmptyDirectionalSprites(): DirectionalSprites {
  return {
    up: null,
    down: null,
    left: null,
    right: null,
    idle: createEmptyDirectionalFrameSet(),
    walk: createEmptyDirectionalFrameSet(),
    run: createEmptyDirectionalFrameSet(),
    cast: createEmptyDirectionalFrameSet(),
    attack: createEmptyDirectionalFrameSet(),
    death: createEmptyDirectionalFrameSet(),
  };
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = async () => {
      try {
        await image.decode();
      } catch {
        // Ignore decode failure and still use the loaded element.
      }
      resolve(image);
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function loadFirstAvailableImage(paths: string[]): Promise<HTMLImageElement | null> {
  for (const path of paths) {
    const image = await loadImage(path);
    if (image) {
      return image;
    }
  }
  return null;
}

function assignDirectionalFrameSet(
  target: Record<Direction, HTMLImageElement[]>,
  frames: Record<Direction, HTMLImageElement[]>,
): void {
  target.up = frames.up;
  target.down = frames.down;
  target.left = frames.left;
  target.right = frames.right;
}

async function loadDirectionalSprites(prefix: string, baseVariants: string[] = [""]): Promise<DirectionalSprites> {
  const fileCandidates = (suffix: string): string[] => baseVariants.map((variant) => (
    variant.length > 0 ? `${prefix}-${suffix}-${variant}.png` : `${prefix}-${suffix}.png`
  ));
  const [down, right, up, left] = await Promise.all([
    loadFirstAvailableImage(fileCandidates("south")),
    loadFirstAvailableImage(fileCandidates("east")),
    loadFirstAvailableImage(fileCandidates("north")),
    loadFirstAvailableImage(fileCandidates("west")),
  ]);

  const walk = createEmptyDirectionalFrameSet();
  void loadWalkCycle(prefix).then((frames) => {
    assignDirectionalFrameSet(walk, frames);
  }).catch(() => {
    // Walk-cycle sprites are a non-critical visual upgrade over static directional sprites.
  });

  return {
    up,
    down,
    left,
    right,
    idle: createEmptyDirectionalFrameSet(),
    walk,
    run: createEmptyDirectionalFrameSet(),
    cast: createEmptyDirectionalFrameSet(),
    attack: createEmptyDirectionalFrameSet(),
    death: createEmptyDirectionalFrameSet(),
  };
}

async function loadWalkCycle(prefix: string): Promise<Record<Direction, HTMLImageElement[]>> {
  return loadCycleFromTemplate((suffix, index) => `${prefix}-walk-${suffix}-${index}.png`);
}

async function loadChampionSprites(assets: ChampionAssets): Promise<DirectionalSprites> {
  const loadFrames = async (urls: readonly string[]) => (await Promise.all(urls.map(loadImage))).filter((image): image is HTMLImageElement => image !== null);
  const loadSet = async (set: Readonly<Record<Direction, readonly string[]>>) => ({
    up: await loadFrames(set.up), down: await loadFrames(set.down),
    left: await loadFrames(set.left), right: await loadFrames(set.right),
  });
  const [up, down, left, right, idle, walk, run, cast, attack, death] = await Promise.all([
    loadImage(assets.staticSprites.up), loadImage(assets.staticSprites.down),
    loadImage(assets.staticSprites.left), loadImage(assets.staticSprites.right),
    loadSet(assets.animations.idle), loadSet(assets.animations.walk), loadSet(assets.animations.run),
    loadSet(assets.animations.cast), loadSet(assets.animations.attack), loadSet(assets.animations.death),
  ]);
  return { up, down, left, right, idle, walk: {
    up: walk.up.length ? walk.up : run.up, down: walk.down.length ? walk.down : run.down,
    left: walk.left.length ? walk.left : run.left, right: walk.right.length ? walk.right : run.right,
  }, run, cast, attack, death };
}

async function loadCycleFromTemplate(
  buildPath: (suffix: string, index: number) => string,
): Promise<Record<Direction, HTMLImageElement[]>> {
  const directions: Array<{ key: Direction; suffix: string }> = [
    { key: "down", suffix: "south" },
    { key: "right", suffix: "east" },
    { key: "up", suffix: "north" },
    { key: "left", suffix: "west" },
  ];
  const walk: Record<Direction, HTMLImageElement[]> = {
    up: [],
    down: [],
    left: [],
    right: [],
  };

  await Promise.all(
    directions.map(async ({ key, suffix }) => {
      const frames = await Promise.all(
        Array.from({ length: 12 }, (_, index) => loadImage(buildPath(suffix, index))),
      );
      walk[key] = frames.filter((frame): frame is HTMLImageElement => frame !== null);
    }),
  );

  return walk;
}

function hasLoadedSpriteImage(sprites: DirectionalSprites): boolean {
  if (sprites.up || sprites.down || sprites.left || sprites.right) {
    return true;
  }

  return [
    sprites.idle,
    sprites.walk,
    sprites.run,
    sprites.cast,
    sprites.attack,
    sprites.death,
  ].some((framesByDirection) => Object.values(framesByDirection).some((frames) => frames.length > 0));
}

export function composeCharacterRoster(): CharacterRosterEntry[] {
  return listCharacterDefinitions().map((entry, selectionIndex) => ({
    id: entry.id, name: entry.name, size: getChampionAssets(entry.id).size, assets: getChampionAssets(entry.id),
    selectionIndex, pinned: entry.roster.defaultSlot !== undefined,
    ...(entry.roster.defaultSlot === undefined ? {} : { defaultSlot: entry.roster.defaultSlot }),
    order: entry.roster.order,
  }));
}

async function loadCharacterRoster(): Promise<CharacterRosterEntry[]> {
  return composeCharacterRoster();
}

function getFallbackSpritesForRosterEntry(
  entry: CharacterRosterEntry,
  playerSprites: Partial<Record<PlayerId, DirectionalSprites>>,
): DirectionalSprites {
  const fallbackSlot = entry.defaultSlot ?? 1;
  return playerSprites[fallbackSlot]
    ?? playerSprites[1]
    ?? createEmptyDirectionalSprites();
}

function fillMissingStaticDirections(
  sprites: DirectionalSprites,
  fallback: DirectionalSprites,
): DirectionalSprites {
  return {
    ...sprites,
    up: sprites.up ?? fallback.up,
    down: sprites.down ?? fallback.down,
    left: sprites.left ?? fallback.left,
    right: sprites.right ?? fallback.right,
  };
}

function createCharacterSpriteLoader(
  playerSprites: Partial<Record<PlayerId, DirectionalSprites>>,
): (entry: CharacterRosterEntry) => Promise<DirectionalSprites> {
  const spriteLoadCache = new Map<string, Promise<DirectionalSprites>>();
  return (entry: CharacterRosterEntry): Promise<DirectionalSprites> => {
    const cached = spriteLoadCache.get(entry.id);
    if (cached) {
      return cached;
    }

    const loaded = (entry.assets ? loadChampionSprites(entry.assets) : Promise.resolve(createEmptyDirectionalSprites())).then((sprites) => {
      const fallback = getFallbackSpritesForRosterEntry(entry, playerSprites);
      return hasLoadedSpriteImage(sprites)
        ? fillMissingStaticDirections(sprites, fallback)
        : fallback;
    });
    spriteLoadCache.set(entry.id, loaded);
    return loaded;
  };
}

export async function loadGameAssets(arenaThemeId?: string | null): Promise<GameAssets> {
  const resolvedTheme = arenaThemeId ? getArenaThemeById(arenaThemeId) : null;
  const arenaTheme = resolvedTheme ?? resolveArenaTheme(typeof window !== "undefined" ? window.location.search : "");
  const arenaTilePaths = arenaTheme.renderMode === "sprite" ? arenaTheme.tilePaths ?? null : null;
  const powerUpDefinitions = listPowerUpDefinitions();
  const [baseAssets, powerUpEntries] = await Promise.all([
    Promise.all([
      loadDirectionalSprites(assetUrl("/Assets/Characters/Animations/default-players/player1"), ["hires", ""]),
      loadDirectionalSprites(assetUrl("/Assets/Characters/Animations/default-players/player2")),
      loadCharacterRoster(),
      arenaTilePaths
        ? loadFirstAvailableImage([resolveGameAsset(arenaTilePaths.base), resolveGameAsset("arena.shared.floor.base")])
        : Promise.resolve(null),
      arenaTilePaths?.baseAlt
        ? loadFirstAvailableImage([resolveGameAsset(arenaTilePaths.baseAlt)])
        : Promise.resolve(null),
      arenaTilePaths
        ? loadFirstAvailableImage([resolveGameAsset(arenaTilePaths.lane), resolveGameAsset("arena.shared.floor.lane")])
        : Promise.resolve(null),
      arenaTilePaths
        ? loadFirstAvailableImage([resolveGameAsset(arenaTilePaths.spawn), resolveGameAsset("arena.shared.floor.spawn")])
        : Promise.resolve(null),
      arenaTilePaths?.portal
        ? loadFirstAvailableImage([resolveGameAsset(arenaTilePaths.portal)])
        : Promise.resolve(null),
      arenaTilePaths
        ? loadFirstAvailableImage([resolveGameAsset(arenaTilePaths.wall), resolveGameAsset("arena.shared.wall")])
        : Promise.resolve(null),
      arenaTilePaths?.wallAlt
        ? loadFirstAvailableImage([resolveGameAsset(arenaTilePaths.wallAlt)])
        : Promise.resolve(null),
      arenaTilePaths
        ? loadFirstAvailableImage([resolveGameAsset(arenaTilePaths.crate), resolveGameAsset("gameplay.crate.sprite")])
        : Promise.resolve(null),
      arenaTilePaths?.crateAlt
        ? loadFirstAvailableImage([resolveGameAsset(arenaTilePaths.crateAlt)])
        : Promise.resolve(null),
      loadImage(resolveGameAsset("gameplay.crate.break.0")),
      loadImage(resolveGameAsset("gameplay.crate.break.1")),
      loadImage(resolveGameAsset("gameplay.crate.break.2")),
      loadImage(resolveGameAsset("gameplay.crate.break.3")),
      loadImage(resolveGameAsset("gameplay.bomb.sprite")),
      loadImage(resolveGameAsset("gameplay.bomb.flame")),
      loadImage(resolveGameAsset("gameplay.bomb.flame.anim-sheet")),
      loadImage(resolveGameAsset("effect.movement.speed-spark-trail")),
      loadImage(resolveGameAsset("ui.arena.victory-emblem")),
      loadImage(resolveGameAsset("ui.arena.stalemate-emblem")),
      loadImage(resolveGameAsset("ui.hud.chrome.local")),
      loadImage(resolveGameAsset("ui.hud.chrome.rival")),
      loadImage(resolveGameAsset("ui.hud.chrome.center")),
      loadImage(resolveGameAsset("ui.hud.chrome.ult")),
      loadImage(resolveGameAsset("ui.hud.icon.bomb")),
      loadImage(resolveGameAsset("ui.hud.icon.flame")),
      loadImage(resolveGameAsset("ui.hud.icon.speed")),
    ]),
    Promise.all(powerUpDefinitions.map(async (definition) => ([
      definition.type,
      await loadImage(resolveGameAsset(definition.asset.id)),
    ] as const))),
  ]);
  const [
    playerOne,
    playerTwo,
    characterRosterFromManifest,
    floorBase,
    floorBaseAlt,
    floorLane,
    floorSpawn,
    floorPortal,
    wall,
    wallAlt,
    crate,
    crateAlt,
    crateBreak0,
    crateBreak1,
    crateBreak2,
    crateBreak3,
    bomb,
    flame,
    flameAnimSheet,
    speedSparkTrail,
    victoryEmblem,
    stalemateEmblem,
    hudPanelLocal,
    hudPanelRival,
    hudPanelCenter,
    hudChipUlt,
    hudIconBomb,
    hudIconFlame,
    hudIconSpeed,
  ] = baseAssets;
  const playerSprites: Partial<Record<PlayerId, DirectionalSprites>> = {
    1: playerOne,
    2: playerTwo,
    3: playerOne,
    4: playerTwo,
  };
  const characterSpriteLoader = createCharacterSpriteLoader(playerSprites);

  const fallbackRoster: CharacterRosterEntry[] = [
    {
      id: "default-p1",
      name: "Bomba Ranger Cyan",
      size: null,
      sprites: playerOne,
      pinned: true,
      defaultSlot: 1,
      order: 0,
    },
    {
      id: "default-p2",
      name: "Bomba Ranger Amber",
      size: null,
      sprites: playerTwo,
      pinned: true,
      defaultSlot: 2,
      order: 1,
    },
  ];

  return {
    players: playerSprites,
    arenaTheme,
    characterRoster: characterRosterFromManifest.length > 0
      ? characterRosterFromManifest
      : fallbackRoster,
    floor: {
      base: floorBase,
      baseAlt: floorBaseAlt,
      lane: floorLane,
      spawn: floorSpawn,
      portal: floorPortal,
    },
    props: {
      wall,
      wallAlt,
      crate,
      crateAlt,
      crateBreakFrames: [crateBreak0, crateBreak1, crateBreak2, crateBreak3]
        .filter((frame): frame is HTMLImageElement => frame !== null),
      bomb,
      flame,
      flameAnimSheet,
    },
    effects: {
      speedSparkTrail,
    },
    ui: {
      victoryEmblem,
      stalemateEmblem,
    },
    hud: {
      panelLocal: hudPanelLocal,
      panelRival: hudPanelRival,
      panelCenter: hudPanelCenter,
      chipUlt: hudChipUlt,
      iconBomb: hudIconBomb,
      iconFlame: hudIconFlame,
      iconSpeed: hudIconSpeed,
    },
    powerUps: Object.fromEntries(powerUpEntries) as Partial<Record<PowerUpType, HTMLImageElement | null>>,
    characterSpriteLoader,
  };
}

export function spriteForDirection(
  sprites: DirectionalSprites,
  direction: Direction,
): HTMLImageElement | null {
  if (direction === "up") return sprites.up;
  if (direction === "down") return sprites.down;
  if (direction === "left") return sprites.left;
  return sprites.right;
}
