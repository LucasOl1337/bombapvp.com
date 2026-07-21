/**
 * Presentation roster for GameMechanics mode 4.
 * Loads every Champion visual pack + presentation copy from Champions/.
 * Kernel skills match membership skillIds (GameMechanics multi-skill module).
 */

import {
  getChampionAssets,
  listChampionAssetEntries,
} from "../../../Champions/assets-catalog.ts";
import {
  getCharacterDefinition,
  listCharacterDefinitions,
} from "../../../Champions/catalog.ts";
import {
  CHAMPION_MEMBERSHIP,
  listChampionMembership,
  type ChampionSlug,
} from "../../../Champions/membership.ts";
import type { CharacterDefinition } from "../../../Champions/contracts.ts";
import { isSkillId, type SkillId } from "../contracts.ts";

export type Facing = "south" | "north" | "east" | "west";

/** Hook projectile sprites (Thresh-only, loaded from Champions/thresh/assets/hook/). */
export type HookProjectileAssets = Readonly<{
  head: Readonly<Record<Facing, string>>;
  chainLink: string;
  impact: readonly string[];
}>;

export type ChampPack = Readonly<{
  portrait: string;
  static: Readonly<Record<Facing, string>>;
  idle: Readonly<Record<Facing, readonly string[]>>;
  walk: Readonly<Record<Facing, readonly string[]>>;
  cast: Readonly<Record<Facing, readonly string[]>>;
  death: Readonly<Record<Facing, readonly string[]>>;
  hookProjectile?: HookProjectileAssets;
}>;

export type ChampAccent = CharacterDefinition["presentation"]["accent"];

export type ChampPresentation = Readonly<{
  slug: ChampionSlug;
  characterId: string;
  name: string;
  accent: ChampAccent;
  skillId: string;
  skillCooldownMs: number;
  skillName: string;
  skillSummary: string;
  label: string;
  description: string;
  portrait: string;
  /** Kernel skill id when the seat is assigned this champion. */
  kernelSkillId: SkillId | undefined;
  /**
   * Arena draw scale vs classic padded packs (Ranni/Nico/Bee ≈ 1).
   * Dense 160px packs fill ~0.75–0.90 of the cell; after height-normalize they
   * read oversized. This compensates presentation only — hitbox is unchanged.
   */
  arenaScale: number;
  pack: ChampPack;
}>;

/**
 * Optical arena scale. Classic padded sprites stay at 1; dense full-cell packs
 * shrink so feet/body footprint match Ranni-class champions.
 */
const ARENA_OPTICAL_SCALE: Readonly<Record<ChampionSlug, number>> = Object.freeze({
  ranni: 1,
  "killer-bee": 1,
  nico: 1,
  "crocodilo-arcano": 0.96,
  mirelle: 0.9,
  "nix-ember": 0.86,
  madara: 0.86,
  pendula: 0.84,
  "lee-sin": 0.84,
  katarina: 0.82,
  thresh: 0.78,
});

const FACING_FROM_DIR = {
  up: "north",
  down: "south",
  left: "west",
  right: "east",
} as const;

function mapFacingRecord(
  source: Readonly<Record<"up" | "down" | "left" | "right", string>>,
): Readonly<Record<Facing, string>> {
  return Object.freeze({
    north: source.up,
    south: source.down,
    west: source.left,
    east: source.right,
  });
}

function mapFacingFrames(
  source: Readonly<Record<"up" | "down" | "left" | "right", readonly string[]>>,
): Readonly<Record<Facing, readonly string[]>> {
  return Object.freeze({
    north: Object.freeze([...source.up]),
    south: Object.freeze([...source.down]),
    west: Object.freeze([...source.left]),
    east: Object.freeze([...source.right]),
  });
}

function packFromAssets(
  assets: ReturnType<typeof getChampionAssets>,
): ChampPack {
  const walkSource =
    assets.animations.walk.down.length > 0
      ? assets.animations.walk
      : assets.animations.run;
  return Object.freeze({
    portrait: assets.portraitUrl,
    static: mapFacingRecord(assets.staticSprites),
    idle: mapFacingFrames(assets.animations.idle),
    walk: mapFacingFrames(walkSource),
    cast: mapFacingFrames(
      assets.animations.ultimate.down.length > 0
        ? assets.animations.ultimate
        : assets.animations.cast,
    ),
    death: mapFacingFrames(assets.animations.death),
  });
}

/** Load Thresh hook projectile sprites from the champion's hook asset folder. */
function loadThreshHookAssets(): HookProjectileAssets | undefined {
  const glob = import.meta.glob(
    "../../../Champions/thresh/assets/hook/*.png",
    { eager: true, import: "default", query: "?url" },
  ) as Record<string, string>;
  const head: Partial<Record<Facing, string>> = {};
  let chainLink: string | undefined;
  const impact: string[] = [];
  for (const [path, url] of Object.entries(glob)) {
    const name = path.split("/").pop()?.replace(".png", "") ?? "";
    if (name.startsWith("hook-head-")) {
      const dir = name.replace("hook-head-", "") as Facing;
      if (["south", "north", "east", "west"].includes(dir)) head[dir] = url;
    } else if (name === "hook-chain-link") {
      chainLink = url;
    } else if (name.startsWith("hook-impact-")) {
      const idx = Number.parseInt(name.replace("hook-impact-", ""), 10);
      if (Number.isFinite(idx)) impact[idx] = url;
    }
  }
  if (!chainLink || Object.keys(head).length === 0) return undefined;
  return Object.freeze({
    head: Object.freeze(head as Record<Facing, string>),
    chainLink,
    impact: Object.freeze(impact.filter(Boolean)),
  });
}

function kernelSkillFor(slug: ChampionSlug): SkillId | undefined {
  const skillId = CHAMPION_MEMBERSHIP[slug].skillId;
  return isSkillId(skillId) ? skillId : undefined;
}

const PRESENTATIONS: readonly ChampPresentation[] = Object.freeze(
  listChampionMembership().map(({ slug, characterId, skillId, skillCooldownMs, name }) => {
    const definition = getCharacterDefinition(characterId);
    if (!definition) throw new Error(`Missing definition for ${slug}`);
    const assets = getChampionAssets(characterId);
    const locale = definition.presentation.localized["pt-BR"];
    const pack = packFromAssets(assets);
    // Thresh gets hook projectile sprites loaded from its champion folder.
    const hookProjectile = slug === "thresh" ? loadThreshHookAssets() : undefined;
    const fullPack = hookProjectile
      ? Object.freeze({ ...pack, hookProjectile })
      : pack;
    return Object.freeze({
      slug,
      characterId,
      name,
      accent: definition.presentation.accent,
      skillId,
      skillCooldownMs,
      skillName: locale.skillName,
      skillSummary: locale.skillSummary,
      label: locale.label,
      description: locale.description,
      portrait: assets.portraitUrl,
      kernelSkillId: kernelSkillFor(slug),
      arenaScale: ARENA_OPTICAL_SCALE[slug] ?? 1,
      pack: fullPack,
    });
  }),
);

const BY_SLUG = new Map(PRESENTATIONS.map((entry) => [entry.slug, entry]));
const BY_ID = new Map(PRESENTATIONS.map((entry) => [entry.characterId, entry]));

export const DEFAULT_P1_SLUG: ChampionSlug = "ranni";
export const DEFAULT_P2_SLUG: ChampionSlug = "nico";

export function listChampionPresentations(): readonly ChampPresentation[] {
  return PRESENTATIONS;
}

export function getChampionPresentation(slug: string): ChampPresentation | null {
  return BY_SLUG.get(slug as ChampionSlug) ?? null;
}

export function getChampionPresentationById(characterId: string): ChampPresentation | null {
  return BY_ID.get(characterId) ?? null;
}

export function resolveChampionSlug(raw: string | null | undefined, fallback: ChampionSlug): ChampionSlug {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized in CHAMPION_MEMBERSHIP) return normalized as ChampionSlug;
  // Accept character UUID as well.
  const byId = BY_ID.get(normalized);
  if (byId) return byId.slug;
  return fallback;
}

/** All portrait + sprite URLs for preload. */
export function collectChampionAssetUrls(
  presentations: readonly ChampPresentation[] = PRESENTATIONS,
): readonly string[] {
  const urls = new Set<string>();
  for (const entry of presentations) {
    urls.add(entry.portrait);
    const pack = entry.pack;
    for (const facing of ["south", "north", "east", "west"] as const) {
      urls.add(pack.static[facing]);
      for (const frame of pack.idle[facing]) urls.add(frame);
      for (const frame of pack.walk[facing]) urls.add(frame);
      for (const frame of pack.cast[facing]) urls.add(frame);
      for (const frame of pack.death[facing]) urls.add(frame);
    }
    // Preload hook projectile sprites when present.
    if (pack.hookProjectile) {
      for (const url of Object.values(pack.hookProjectile.head)) urls.add(url);
      urls.add(pack.hookProjectile.chainLink);
      for (const url of pack.hookProjectile.impact) urls.add(url);
    }
  }
  return Object.freeze([...urls]);
}

/** Sanity: asset catalog and definitions stay aligned with membership. */
export function assertChampionRosterHealthy(): void {
  if (listCharacterDefinitions().length !== PRESENTATIONS.length) {
    throw new Error("Champion definition count does not match presentation roster.");
  }
  if (listChampionAssetEntries().length !== PRESENTATIONS.length) {
    throw new Error("Champion asset count does not match presentation roster.");
  }
  void FACING_FROM_DIR;
}

assertChampionRosterHealthy();
