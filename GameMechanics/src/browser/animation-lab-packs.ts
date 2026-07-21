type RawAnimationLabManifest = Readonly<{
  id: string;
  category: string;
  status: string;
  animation?: Readonly<{
    frameCount?: number;
    timingMsPerFrame?: number;
    timing?: string;
    durationMs?: number;
  }>;
}>;

/** Runtime categories shared by the lab catalog and browser event adapter. */
export type AnimationLabCategory = "bomb" | "hit" | "power-up" | "arena" | "hud";

export type AnimationLabPackId = string;

export type AnimationLabPack = Readonly<{
  id: AnimationLabPackId;
  category: AnimationLabCategory;
  atlasUrl: string;
  frameCount: number;
  columns: 4;
  rows: 4;
  frameSize: 256;
  frameMs: number;
  durationMs: number;
}>;

const manifestModules = import.meta.glob(
  "../../assets/animation-lab/2026-07-21/*/manifest.json",
  { eager: true, import: "default" },
) as Record<string, RawAnimationLabManifest>;

const atlasModules = import.meta.glob(
  "../../assets/animation-lab/2026-07-21/*/spritesheet-runtime-4x4-256*.png",
  { eager: true, import: "default", query: "?url" },
) as Record<string, string>;

function directoryOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

function variantPriority(path: string): number {
  const version = path.match(/-v(\d+)\.png$/)?.[1];
  return version ? Number(version) : 0;
}

function normalizedCategory(raw: string): AnimationLabCategory | null {
  const category = raw.toLowerCase();
  if (category.includes("bomb") || category.includes("bomba") || category.includes("fus")) {
    return "bomb";
  }
  if (category.includes("power-up")) return "power-up";
  if (category.includes("hud")) return "hud";
  if (category.includes("arena")) return "arena";
  if (category.includes("hit") || category.includes("impact")) return "hit";
  return null;
}

function timingMs(manifest: RawAnimationLabManifest): number {
  const explicit = manifest.animation?.timingMsPerFrame;
  if (typeof explicit === "number" && explicit > 0) return explicit;
  const timing = manifest.animation?.timing?.match(/(\d+)\s*ms/i)?.[1];
  return timing ? Math.max(1, Number(timing)) : 60;
}

const atlasByDirectory = new Map<string, string>();
for (const [path, url] of Object.entries(atlasModules).sort(
  ([a], [b]) => variantPriority(b) - variantPriority(a) || a.localeCompare(b),
)) {
  const directory = directoryOf(path);
  if (!atlasByDirectory.has(directory)) atlasByDirectory.set(directory, url);
}

const packs = Object.entries(manifestModules)
  .map(([manifestPath, manifest]) => {
    const category = normalizedCategory(manifest.category);
    const atlasUrl = atlasByDirectory.get(directoryOf(manifestPath));
    if (!category || !atlasUrl || (manifest.status !== "Candidato" && manifest.status !== "Integrado")) {
      return null;
    }
    const frameCount = Math.max(1, manifest.animation?.frameCount ?? 16);
    const frameMs = timingMs(manifest);
    return {
      id: manifest.id,
      category,
      atlasUrl,
      frameCount,
      columns: 4,
      rows: 4,
      frameSize: 256,
      frameMs,
      durationMs: manifest.animation?.durationMs ?? frameCount * frameMs,
    } satisfies AnimationLabPack;
  })
  .filter((pack): pack is AnimationLabPack => pack !== null)
  .sort((a, b) => a.id.localeCompare(b.id));

export const ANIMATION_LAB_PACKS: readonly AnimationLabPack[] = Object.freeze(packs);

export function getAnimationLabPack(id: AnimationLabPackId): AnimationLabPack {
  const pack = ANIMATION_LAB_PACKS.find((entry) => entry.id === id);
  if (!pack) throw new Error(`Unknown animation-lab pack: ${id}`);
  return pack;
}

const packsByCategory = new Map<AnimationLabCategory, readonly AnimationLabPack[]>();
for (const category of ["bomb", "hit", "power-up", "arena", "hud"] as const) {
  packsByCategory.set(
    category,
    Object.freeze(ANIMATION_LAB_PACKS.filter((pack) => pack.category === category)),
  );
}

const categoryCursors = new Map<AnimationLabCategory, number>();

/**
 * Selects every validated pack over successive gameplay events. The cursor is
 * presentation-only, reset on restart, and never influences kernel state.
 */
export function nextAnimationLabPack(category: AnimationLabCategory): AnimationLabPack | null {
  const categoryPacks = packsByCategory.get(category) ?? [];
  if (categoryPacks.length === 0) return null;
  const cursor = categoryCursors.get(category) ?? 0;
  categoryCursors.set(category, (cursor + 1) % categoryPacks.length);
  return categoryPacks[cursor] ?? null;
}

export function resetAnimationLabRotation(): void {
  categoryCursors.clear();
}
