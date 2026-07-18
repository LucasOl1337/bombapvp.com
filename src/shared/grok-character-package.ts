import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type GrokCharacterClipId =
  "idle-south" | "walk-south" | "cast-south" | "plant-south";

export type GrokCharacterManifest = {
  slug: string;
  displayName: string;
  packageKind?: string;
  notLiveRoster?: boolean;
  ultimate: {
    id: string;
    name: string;
    role: string;
    summary: string;
  };
  clips: Record<
    GrokCharacterClipId,
    {
      frames: number;
      slot: string;
      dir: string;
      bakesBomb?: boolean;
      skill?: string;
    }
  >;
  previews?: {
    portrait?: string;
    sheets?: string[];
    gifs?: string[];
    videos?: string[];
  };
  rules?: {
    plantNeverBakesBomb?: boolean;
    oneUltimateOnly?: boolean;
  };
  bannedRosterNames?: string[];
};

export type GrokCharacterPackageReport = {
  ok: boolean;
  packageRoot: string;
  displayName: string | null;
  ultimateName: string | null;
  ultimateSummary: string | null;
  clipFrameCounts: Partial<Record<GrokCharacterClipId, number>>;
  missing: string[];
  errors: string[];
};

const REQUIRED_CLIPS: readonly GrokCharacterClipId[] = [
  "idle-south",
  "walk-south",
  "cast-south",
  "plant-south",
];

const LIVE_ROSTER_NAMES = [
  "Ranni",
  "Killer Bee",
  "Crocodilo Arcano",
  "Nico",
] as const;

/**
 * Validates a Grok lab character package on disk (manifest + selected frame clips).
 * Used by contract tests; not a live roster loader.
 */
export function loadGrokCharacterManifest(
  packageRoot: string,
): GrokCharacterManifest {
  const manifestPath = join(packageRoot, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest.json under ${packageRoot}`);
  }
  return JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as GrokCharacterManifest;
}

export function countSelectedFrames(
  packageRoot: string,
  relativeDir: string,
  prefix: string,
): number {
  const abs = join(packageRoot, relativeDir);
  if (!existsSync(abs)) {
    return 0;
  }
  return readdirSync(abs).filter((name) => {
    if (name.includes("@")) {
      return false;
    }
    return name.startsWith(prefix) && name.endsWith(".png");
  }).length;
}

export function validateGrokCharacterPackage(
  packageRoot: string,
): GrokCharacterPackageReport {
  const missing: string[] = [];
  const errors: string[] = [];
  const clipFrameCounts: Partial<Record<GrokCharacterClipId, number>> = {};

  if (!existsSync(packageRoot)) {
    return {
      ok: false,
      packageRoot,
      displayName: null,
      ultimateName: null,
      ultimateSummary: null,
      clipFrameCounts,
      missing: ["packageRoot"],
      errors: [`Package root does not exist: ${packageRoot}`],
    };
  }

  if (!existsSync(join(packageRoot, "README.md"))) {
    missing.push("README.md");
  }
  if (!existsSync(join(packageRoot, "manifest.json"))) {
    missing.push("manifest.json");
    return {
      ok: false,
      packageRoot,
      displayName: null,
      ultimateName: null,
      ultimateSummary: null,
      clipFrameCounts,
      missing,
      errors: ["manifest.json is required"],
    };
  }

  let manifest: GrokCharacterManifest;
  try {
    manifest = loadGrokCharacterManifest(packageRoot);
  } catch (error) {
    return {
      ok: false,
      packageRoot,
      displayName: null,
      ultimateName: null,
      ultimateSummary: null,
      clipFrameCounts,
      missing,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  if (!manifest.displayName?.trim()) {
    errors.push("displayName is empty");
  }
  if (
    LIVE_ROSTER_NAMES.some(
      (name) =>
        name.toLowerCase() === manifest.displayName?.trim().toLowerCase(),
    )
  ) {
    errors.push(
      `displayName collides with live roster: ${manifest.displayName}`,
    );
  }
  if (!manifest.ultimate?.name?.trim()) {
    errors.push("ultimate.name is empty");
  }
  if (!manifest.ultimate?.summary?.trim()) {
    errors.push("ultimate.summary is empty");
  }
  if (manifest.rules?.plantNeverBakesBomb !== true) {
    errors.push("rules.plantNeverBakesBomb must be true");
  }
  if (manifest.clips?.["plant-south"]?.bakesBomb === true) {
    errors.push("plant-south must not bake a bomb prop (bakesBomb=true)");
  }

  for (const clipId of REQUIRED_CLIPS) {
    const clip = manifest.clips?.[clipId];
    if (!clip) {
      missing.push(`clips.${clipId}`);
      continue;
    }
    const prefix = clipId;
    const count = countSelectedFrames(packageRoot, clip.dir, prefix);
    clipFrameCounts[clipId] = count;
    if (count <= 0) {
      missing.push(`${clip.dir} frames`);
    } else if (typeof clip.frames === "number" && count !== clip.frames) {
      errors.push(`${clipId}: expected ${clip.frames} frames, found ${count}`);
    }
  }

  const previewPaths = [
    manifest.previews?.portrait,
    ...(manifest.previews?.sheets ?? []),
    ...(manifest.previews?.gifs ?? []),
    ...(manifest.previews?.videos ?? []),
  ].filter((value): value is string => Boolean(value));

  for (const relative of previewPaths) {
    if (!existsSync(join(packageRoot, relative))) {
      missing.push(relative);
    }
  }

  return {
    ok: missing.length === 0 && errors.length === 0,
    packageRoot,
    displayName: manifest.displayName ?? null,
    ultimateName: manifest.ultimate?.name ?? null,
    ultimateSummary: manifest.ultimate?.summary ?? null,
    clipFrameCounts,
    missing,
    errors,
  };
}

export function resolveNixEmberPackageRoot(
  repoRoot: string = process.cwd(),
): string {
  // Lab art pipeline + selected frames (engine loads Champions/nix-ember/assets/)
  return join(repoRoot, "Champions", "nix-ember", "experiments", "lab-pack");
}
