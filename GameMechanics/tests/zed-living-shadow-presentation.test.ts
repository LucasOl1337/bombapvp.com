import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getLauncherPreview } from "../../Champions/launcher-previews.ts";
import { CHAMPION_MEMBERSHIP } from "../../Champions/membership.ts";
import {
  createBrowserMatchConfiguration,
  parseBrowserLaunchState,
  resolveChampionSlug,
} from "../src/browser/match-mode.ts";
import { getChampionPresentation } from "../src/browser/champion-packs.ts";
import { ZED_LIVING_SHADOW_SKILL_ID } from "../src/contracts.ts";

const ZED_ASSETS = join(process.cwd(), "Champions", "zed", "assets");

describe("Zed Living Shadow playable package", () => {
  it("registers membership identity with Living Shadow skill and no default seat", () => {
    const zed = CHAMPION_MEMBERSHIP.zed;
    expect(zed).toMatchObject({
      characterId: "14fdf68c-c822-4d25-aee8-38b2d30739eb",
      skillId: ZED_LIVING_SHADOW_SKILL_ID,
      name: "Zed",
      rosterOrder: 4,
      skillCooldownMs: 7_000,
    });
    expect(zed.defaultSlot).toBeUndefined();
  });

  it("loads presentation pack with portrait, statics, and skill animation coverage", () => {
    const zed = getChampionPresentation("zed");
    expect(zed).not.toBeNull();
    expect(zed?.kernelSkillId).toBe(ZED_LIVING_SHADOW_SKILL_ID);
    expect(zed?.accent).toBe("orange");
    expect(zed?.skillName).toMatch(/Living Shadow|Sombra/i);
    expect(zed?.portrait).toBeTruthy();
    expect(existsSync(join(ZED_ASSETS, "portrait.png"))).toBe(true);

    const pack = zed!.pack;
    for (const facing of ["south", "north", "east", "west"] as const) {
      expect(pack.static[facing], `static ${facing}`).toBeTruthy();
      expect(pack.idle[facing].length, `idle ${facing}`).toBeGreaterThanOrEqual(6);
      expect(pack.walk[facing].length, `walk ${facing}`).toBe(8);
      expect(pack.run[facing].length, `run ${facing}`).toBe(8);
      expect(pack.cast[facing].length, `cast ${facing}`).toBe(8);
      expect(pack.attack[facing].length, `attack ${facing}`).toBe(8);
      expect(pack.death[facing].length, `death ${facing}`).toBe(8);
    }

    const animationFiles = readdirSync(join(ZED_ASSETS, "animations")).filter((f) =>
      f.endsWith(".png"),
    );
    expect(animationFiles.length).toBeGreaterThanOrEqual(100);
    expect(animationFiles.some((f) => f.startsWith("attack-"))).toBe(true);
    // Attack frames are body-only (bomb is engine-drawn); filenames never encode bomb art.
    expect(animationFiles.every((f) => !f.includes("bomb"))).toBe(true);

    const launcher = getLauncherPreview(CHAMPION_MEMBERSHIP.zed.characterId);
    expect(launcher?.presentation).toEqual({
      scale: 0.9,
      offsetXPercent: 0,
      offsetYPercent: 0,
    });
    expect(launcher?.clips.map(({ name, frames }) => [name, frames.length])).toEqual([
      ["idle", 6],
      ["walk", 8],
      ["run", 8],
      ["cast", 8],
      ["attack", 8],
    ]);
  });

  it("is selectable via URL without changing default ranni/killer-bee seats", () => {
    expect(resolveChampionSlug("zed", "ranni")).toBe("zed");
    expect(resolveChampionSlug(CHAMPION_MEMBERSHIP.zed.characterId, "ranni")).toBe("zed");

    const defaults = parseBrowserLaunchState("");
    expect(defaults.configuration.players.map((p) => p.championSlug)).toEqual([
      "ranni",
      "killer-bee",
    ]);

    const zedMatch = createBrowserMatchConfiguration({
      mode: "local-duel",
      champion1: "zed",
      champion2: "killer-bee",
    });
    expect(zedMatch.players[0]).toEqual({ control: "human", championSlug: "zed" });
    expect(zedMatch.players[1]).toEqual({ control: "human", championSlug: "killer-bee" });

    const deepLink = parseBrowserLaunchState("?mode=local&p1=zed&p2=ranni&skipSelect=1");
    expect(deepLink.skipSelection).toBe(true);
    expect(deepLink.configuration.players[0].championSlug).toBe("zed");
    expect(deepLink.configuration.players[1].championSlug).toBe("ranni");
  });

  it("does not rename or remove shipped champions", () => {
    expect(CHAMPION_MEMBERSHIP.ranni.name).toBe("Ranni");
    expect(CHAMPION_MEMBERSHIP["killer-bee"].name).toBe("Killer Bee");
    expect(getChampionPresentation("ranni")?.kernelSkillId).toBe("ranni-ice-blink");
    expect(getChampionPresentation("killer-bee")?.kernelSkillId).toBe(
      "killer-bee-wing-dash",
    );
  });
});
