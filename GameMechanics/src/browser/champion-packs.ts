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
import {
  collectIntegratedAnimationOverrides,
  type ChampionAnimationAction,
  type IntegratedAnimationManifest,
  type IntegratedAnimationOverrides,
} from "./champion-animation-selection.ts";
export {
  DEFAULT_P1_SLUG,
  DEFAULT_P2_SLUG,
  resolveChampionSlug,
} from "./match-mode.ts";

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
  run: Readonly<Record<Facing, readonly string[]>>;
  cast: Readonly<Record<Facing, readonly string[]>>;
  attack: Readonly<Record<Facing, readonly string[]>>;
  ultimate: Readonly<Record<Facing, readonly string[]>>;
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
   * Arena draw scale vs classic padded packs (Ranni/Bee ≈ 1).
   * Dense 160px packs fill ~0.75–0.90 of the cell; after height-normalize they
   * read oversized. This compensates presentation only — hitbox is unchanged.
   */
  arenaScale: number;
  pack: ChampPack;
  integratedAnimations: IntegratedAnimationOverrides;
}>;

const integratedManifestModules = import.meta.glob(
  "../../assets/animation-lab/2026-07-21/*/manifest.json",
  { eager: true, import: "default" },
) as Record<string, IntegratedAnimationManifest>;

const INTEGRATED_ANIMATIONS = collectIntegratedAnimationOverrides(
  Object.values(integratedManifestModules),
);

/**
 * Optical arena scale. Classic padded sprites stay at 1; dense full-cell packs
 * shrink so feet/body footprint match Ranni-class champions.
 */
const ARENA_OPTICAL_SCALE: Readonly<Record<ChampionSlug, number>> = Object.freeze({
  ranni: 1,
  "killer-bee": 1,
  "crocodilo-arcano": 0.96,
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
  return Object.freeze({
    portrait: assets.portraitUrl,
    static: mapFacingRecord(assets.staticSprites),
    idle: mapFacingFrames(assets.animations.idle),
    walk: mapFacingFrames(assets.animations.walk),
    run: mapFacingFrames(assets.animations.run),
    cast: mapFacingFrames(assets.animations.cast),
    attack: mapFacingFrames(assets.animations.attack),
    ultimate: mapFacingFrames(assets.animations.ultimate),
    death: mapFacingFrames(assets.animations.death),
  });
}

function assertIntegratedAnimationsInstalled(
  slug: ChampionSlug,
  pack: ChampPack,
  overrides: IntegratedAnimationOverrides,
): void {
  for (const [action, direction] of Object.entries(overrides) as Array<
    [ChampionAnimationAction, Facing]
  >) {
    if (pack[action][direction].length === 0) {
      throw new Error(`Integrated animation is missing: ${slug}/${action}-${direction}`);
    }
  }
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
    const integratedAnimations = INTEGRATED_ANIMATIONS.get(slug) ?? Object.freeze({});
    assertIntegratedAnimationsInstalled(slug, pack, integratedAnimations);
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
      integratedAnimations,
    });
  }),
);

const BY_SLUG = new Map(PRESENTATIONS.map((entry) => [entry.slug, entry]));
const BY_ID = new Map(PRESENTATIONS.map((entry) => [entry.characterId, entry]));

export function listChampionPresentations(): readonly ChampPresentation[] {
  return PRESENTATIONS;
}

export function getChampionPresentation(slug: string): ChampPresentation | null {
  return BY_SLUG.get(slug as ChampionSlug) ?? null;
}

export function getChampionPresentationById(characterId: string): ChampPresentation | null {
  return BY_ID.get(characterId) ?? null;
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
      for (const frame of pack.run[facing]) urls.add(frame);
      for (const frame of pack.cast[facing]) urls.add(frame);
      for (const frame of pack.attack[facing]) urls.add(frame);
      for (const frame of pack.ultimate[facing]) urls.add(frame);
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
