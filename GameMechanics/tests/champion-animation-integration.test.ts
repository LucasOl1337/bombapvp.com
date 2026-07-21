import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ANIMATION_LAB_PACKS } from "../src/browser/animation-lab-packs.ts";
import { getChampionPresentation } from "../src/browser/champion-packs.ts";
import type {
  AnimationFacing,
  ChampionAnimationAction,
} from "../src/browser/champion-animation-selection.ts";

type LabManifest = Readonly<{
  id: string;
  status?: string;
  runtimeIntegration?: boolean;
  runtimeAction?: ChampionAnimationAction;
  runtimeDirection?: AnimationFacing;
  champion?: Readonly<{ slug?: string }>;
}>;

const LAB_ROOT = join(
  process.cwd(),
  "GameMechanics",
  "assets",
  "animation-lab",
  "2026-07-21",
);

function labManifests(): readonly LabManifest[] {
  return readdirSync(LAB_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(LAB_ROOT, entry.name, "manifest.json"))
    .flatMap((path) => {
      try {
        return [JSON.parse(readFileSync(path, "utf8")) as LabManifest];
      } catch {
        return [];
      }
    });
}

describe("integrated animation lab assets", () => {
  it("ships Ranni's dedicated six-beat ultimate sequence", () => {
    const ranni = getChampionPresentation("ranni");
    expect(ranni?.pack.ultimate.south).toHaveLength(6);
    expect(ranni?.pack.ultimate.north).toHaveLength(0);
  });

  it("keeps the published checkout limited to one approved pack per effect family", () => {
    const manifests = labManifests();

    expect(manifests).toHaveLength(5);
    expect(manifests.every((manifest) => manifest.status === "Integrado")).toBe(true);
    expect(ANIMATION_LAB_PACKS.map((pack) => pack.category).sort()).toEqual([
      "arena",
      "bomb",
      "hit",
      "hud",
      "power-up",
    ]);
  });

  it("installs every runtime-integrated Champion sequence in its presentation pack", () => {
    const integrated = labManifests().filter(
      (manifest) => manifest.runtimeIntegration === true && manifest.champion?.slug,
    );

    for (const manifest of integrated) {
      const slug = manifest.champion?.slug ?? "";
      const action = manifest.runtimeAction;
      const direction = manifest.runtimeDirection;
      const presentation = getChampionPresentation(slug);
      expect(presentation, `missing Champion presentation: ${slug}`).not.toBeNull();
      expect(action, `missing runtime action: ${manifest.id}`).toBeTruthy();
      expect(direction, `missing runtime direction: ${manifest.id}`).toBeTruthy();
      expect(presentation?.integratedAnimations[action!]).toBe(direction);
      expect(presentation?.pack[action!][direction!].length).toBeGreaterThan(0);
    }
  });

  it("publishes only approved non-Champion lab packs through the event rotation", () => {
    const expectedIds = labManifests()
      .filter(
        (manifest) =>
          !manifest.champion
          && manifest.status === "Integrado",
      )
      .map((manifest) => manifest.id)
      .sort();
    const actualIds = ANIMATION_LAB_PACKS.map((pack) => pack.id).sort();

    expect(actualIds).toEqual(expectedIds);
  });
});
