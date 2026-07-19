import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

import { GAME_ASSET_IDS, resolveGameAsset, type GameAssetId } from "../game-assets/index.ts";
import { CITADEL_BREACH_MARKETING } from "../game-assets/marketing.ts";
import { CITADEL_BREACH_VISUALS } from "../game-assets/citadel-breach.ts";
import { getArenaThemeById } from "../src/original-game/Arenas/arena-theme-library.ts";
import { listPowerUpDefinitions } from "../src/original-game/Gameplay/powerups.ts";

const GAME_ASSETS_ROOT = resolve(import.meta.dirname, "../game-assets");
const LEGACY_EMOJI_DIR = join(GAME_ASSETS_ROOT, "gameplay/power-ups/icons/_legacy-emoji-20260719");

/** Read PNG width/height from IHDR without external deps. */
function readPngSize(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  expect(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Map catalog import bindings to relative paths under game-assets/. */
function catalogImportPaths(): Map<string, string> {
  const source = readFileSync(join(GAME_ASSETS_ROOT, "catalog.ts"), "utf8");
  const map = new Map<string, string>();
  const importRe = /import (\w+) from "(\.\/[^"]+)\?url"/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source))) {
    map.set(match[1]!, match[2]!.replace(/^\.\//, ""));
  }
  return map;
}

function catalogIdToBinding(): Map<string, string> {
  const source = readFileSync(join(GAME_ASSETS_ROOT, "catalog.ts"), "utf8");
  const map = new Map<string, string>();
  const entryRe = /"([^"]+)": (\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(source))) {
    map.set(match[1]!, match[2]!);
  }
  return map;
}

describe("game assets", () => {
  it("keeps launcher marketing free of the full catalog import", () => {
    const marketingSource = readFileSync(
      resolve(import.meta.dirname, "../game-assets/marketing.ts"),
      "utf8",
    );
    const viewSource = readFileSync(
      resolve(import.meta.dirname, "../src/app/view.ts"),
      "utf8",
    );
    expect(marketingSource).not.toMatch(/from\s+["']\.\/catalog/);
    // Launcher pulls brand mark + champion previews; it must not pull the full shared catalog barrel.
    expect(viewSource).not.toMatch(/from\s+["']\.\.\/\.\.\/game-assets["']/);
    expect(viewSource).not.toMatch(/from\s+["']\.\.\/\.\.\/game-assets\/catalog/);
    expect(viewSource).not.toMatch(/CITADEL_BREACH_VISUALS/);
    expect(viewSource).toMatch(/game-assets\/ui\/branding/);
    expect(Object.keys(CITADEL_BREACH_VISUALS)).toEqual(
      expect.arrayContaining(["marketing", "arena", "powerUps", "hud", "feedback", "effects"]),
    );
    expect(CITADEL_BREACH_MARKETING.banner.url.length).toBeGreaterThan(0);
    expect(CITADEL_BREACH_MARKETING.keyArt.url.length).toBeGreaterThan(0);
  });

  it("uses the cohesive Arcane Citadel theme tile pack (not motif-heavy shared props)", () => {
    expect(getArenaThemeById("arcane-citadel")?.tilePaths).toMatchObject({
      base: "arena.theme.arcane-citadel.floor.base",
      lane: "arena.theme.arcane-citadel.floor.lane",
      spawn: "arena.theme.arcane-citadel.floor.spawn",
      wall: "arena.theme.arcane-citadel.wall",
      crate: "arena.theme.arcane-citadel.crate",
    });
  });

  it("uses sprite tournament-clean theme tile pack with warm beige palette ids", () => {
    const theme = getArenaThemeById("tournament-clean");
    expect(theme?.renderMode).toBe("sprite");
    expect(theme?.tilePaths).toMatchObject({
      base: "arena.theme.tournament-clean.floor.base",
      lane: "arena.theme.tournament-clean.floor.lane",
      spawn: "arena.theme.tournament-clean.floor.spawn",
      wall: "arena.theme.tournament-clean.wall",
      crate: "arena.theme.tournament-clean.crate",
    });
    expect(theme?.palette.floorBase).toBe("#d8d0c2");
  });

  it.each([
    ["gameplay.bomb.sprite", "bomb.png"],
    ["gameplay.bomb.sprite.ruins", "bomb-ruins.png"],
    ["gameplay.bomb.flame", "flame.png"],
    ["gameplay.bomb.flame.ruins", "flame-ruins.png"],
    ["gameplay.bomb.flame.anim-sheet", "flame-anim-sheet-v1.png"],
    ["effect.explosion.bomb-anim", "bomb-explosion-anim-sheet-v1.png"],
    ["audio.bomb.place", "bomb_place.mp3"],
    ["audio.bomb.explode.default", "bomb_explode_default.mp3"],
    ["audio.bomb.explode.main", "bomb_explode_main.mp3"],
    ["audio.bomb.flames", "flames.mp3"],
    ["arena.theme.arcane-citadel.floor.base", "arenas/themes/arcane-citadel/floor-base.png"],
    ["arena.theme.arcane-citadel.floor.lane", "arenas/themes/arcane-citadel/floor-lane.png"],
    ["arena.theme.arcane-citadel.floor.spawn", "arenas/themes/arcane-citadel/floor-spawn.png"],
    ["arena.theme.arcane-citadel.wall", "arenas/themes/arcane-citadel/wall.png"],
    ["arena.theme.arcane-citadel.crate", "arenas/themes/arcane-citadel/crate.png"],
    ["arena.theme.tournament-clean.floor.base", "arenas/themes/tournament-clean/floor-base.png"],
    ["arena.theme.tournament-clean.floor.lane", "arenas/themes/tournament-clean/floor-lane.png"],
    ["arena.theme.tournament-clean.floor.spawn", "arenas/themes/tournament-clean/floor-spawn.png"],
    ["arena.theme.tournament-clean.wall", "arenas/themes/tournament-clean/wall.png"],
    ["arena.theme.tournament-clean.crate", "arenas/themes/tournament-clean/crate.png"],
    ["arena.theme.verdant-ruins.floor.base", "arenas/themes/verdant-ruins/floor-base.png"],
    ["arena.theme.verdant-ruins.floor.lane", "arenas/themes/verdant-ruins/floor-lane.png"],
    ["arena.theme.verdant-ruins.floor.spawn", "arenas/themes/verdant-ruins/floor-spawn.png"],
    ["arena.theme.verdant-ruins.wall", "arenas/themes/verdant-ruins/wall.png"],
    ["arena.theme.verdant-ruins.crate", "arenas/themes/verdant-ruins/crate.png"],
    ["arena.theme.skyfoundry-bastion.floor.base", "arenas/themes/skyfoundry-bastion/floor-base.png"],
    ["arena.theme.skyfoundry-bastion.floor.lane", "arenas/themes/skyfoundry-bastion/floor-lane.png"],
    ["arena.theme.skyfoundry-bastion.floor.spawn", "arenas/themes/skyfoundry-bastion/floor-spawn.png"],
    ["arena.theme.skyfoundry-bastion.wall", "arenas/themes/skyfoundry-bastion/wall.png"],
    ["arena.theme.skyfoundry-bastion.crate", "arenas/themes/skyfoundry-bastion/crate.png"],
    ["arena.theme.tidal-foundry.floor.base", "arenas/themes/tidal-foundry/floor-base.png"],
    ["arena.theme.tidal-foundry.floor.lane", "arenas/themes/tidal-foundry/floor-lane.png"],
    ["arena.theme.tidal-foundry.floor.spawn", "arenas/themes/tidal-foundry/floor-spawn.png"],
    ["arena.theme.tidal-foundry.wall", "arenas/themes/tidal-foundry/wall.png"],
    ["arena.theme.tidal-foundry.crate", "arenas/themes/tidal-foundry/crate-mare-de-bronze.png"],
    ["arena.theme.ember-kiln.floor.base", "arenas/themes/ember-kiln/floor-base.png"],
    ["arena.theme.ember-kiln.floor.lane", "arenas/themes/ember-kiln/floor-lane.png"],
    ["arena.theme.ember-kiln.floor.spawn", "arenas/themes/ember-kiln/floor-spawn.png"],
    ["arena.theme.ember-kiln.wall", "arenas/themes/ember-kiln/wall.png"],
    ["arena.theme.ember-kiln.crate", "arenas/themes/ember-kiln/crate.png"],
    ["arena.shared.floor.base", "arenas/shared/floor-base.png"],
    ["arena.shared.floor.lane", "arenas/shared/floor-alt.png"],
    ["arena.shared.floor.spawn", "arenas/shared/floor-spawn.png"],
    ["arena.shared.wall", "arenas/shared/wall.png"],
    ["gameplay.crate.sprite", "gameplay/crates/sprites/crate.png"],
    ["gameplay.crate.break.0", "gameplay/crates/break/crate-break-0.png"],
    ["gameplay.crate.break.1", "gameplay/crates/break/crate-break-1.png"],
    ["gameplay.crate.break.2", "gameplay/crates/break/crate-break-2.png"],
    ["gameplay.crate.break.3", "gameplay/crates/break/crate-break-3.png"],
    ["gameplay.power-up.bomb.icon", "gameplay/power-ups/icons/power-bomb.png"],
    ["gameplay.power-up.flame.icon", "gameplay/power-ups/icons/power-flame.png"],
    ["gameplay.power-up.speed.icon", "gameplay/power-ups/icons/power-speed-rastro-relampago.png"],
    ["gameplay.power-up.speed.icon.simple", "gameplay/power-ups/icons/power-speed.png"],
    ["gameplay.power-up.remote.icon", "gameplay/power-ups/icons/power-remote.png"],
    ["gameplay.power-up.shield.icon", "gameplay/power-ups/icons/power-shield.png"],
    ["gameplay.power-up.bomb-pass.icon", "gameplay/power-ups/icons/power-bomb-pass.png"],
    ["gameplay.power-up.kick.icon", "gameplay/power-ups/icons/power-kick.png"],
    ["gameplay.power-up.short-fuse.icon", "gameplay/power-ups/icons/power-short-fuse-v2.png"],
    ["audio.match.start", "audio/match/match_start.mp3"],
    ["audio.match.win", "audio/match/match_win.mp3"],
    ["audio.match.round-end", "audio/match/round_end.wav"],
    ["audio.match.sudden-death-alarm", "audio/match/sudden_death_alarm.wav"],
    ["audio.power-up.collect.default", "audio/power-ups/powerup_collect.mp3"],
    ["audio.power-up.collect.bright", "audio/power-ups/powerup_collect_bright.mp3"],
    ["audio.power-up.collect.crystal", "audio/power-ups/powerup_collect_crystal.mp3"],
    ["audio.gameplay.shield-block-deflect", "audio/gameplay/shield_block_deflect.mp3"],
    ["effect.movement.speed-spark-trail", "effects/movement/speed-spark-trail.png"],
    ["ui.arena.victory-emblem", "ui/arena/arena-victory-emblem.webp"],
    ["ui.arena.stalemate-emblem", "ui/arena/arena-stalemate-emblem.png"],
    ["ui.launcher.match-bay", "ui/launcher/launcher-match-bay-v1.webp"],
    ["marketing.hero.arena-sigil", "marketing/hero-arena-sigil.webp"],
    ["marketing.hero.match-control", "marketing/hero-match-control-v2.webp"],
    ["arena.shared.arc-rune-danger-telegraph", "arenas/shared/arc-rune-danger-telegraph-v1.png"],
    ["arena.shared.citadel-reactor-block", "arenas/shared/citadel-breach-reactor-block-v1-20260718-1527.png"],
    ["arena.shared.citadel-conduit-floor", "arenas/shared/citadel-conduit-floor-tile-v2-20260718-1635.png"],
    ["arena.shared.citadel-gate-obstacle", "arenas/shared/citadel-gate-obstacle-v2-20260718-1752.png"],
    ["effect.explosion.arc-flare-impact", "effects/explosions/arc-flare-impact-sheet-v1.png"],
    ["effect.combo.chain-pulse", "effects/combo/chain-combo-pulse-sheet-20260718-1509-v1.png"],
    ["effect.structural.rupture-burst", "effects/structural/structural-rupture-burst-sheet-20260718-1558-v2.png"],
    ["effect.alert.fuse-critical-pulse", "effects/alerts/fuse-critical-pulse-sheet-20260718-1716-v2.png"],
    ["effect.activation.echo-charge", "effects/activation/echo-charge-activation-burst-v1-20260718-1625.png"],
    ["effect.obstacle.citadel-gate-lock-pulse", "effects/obstacles/citadel-gate-lock-pulse-v1-20260718-1756.png"],
    ["gameplay.feedback.bomb-kick", "gameplay/feedback/bomb-kick-telegraph-v1-20260718.png"],
    ["gameplay.feedback.bomb-plant-confirmation", "gameplay/feedback/bomb-plant-confirmation-marker-v2-20260718-1736.png"],
    ["gameplay.power-up.chain-reaction.icon", "gameplay/power-ups/icons/power-chain-reaction-v1.png"],
    ["gameplay.power-up.breach-shard.icon", "gameplay/power-ups/icons/power-breach-shard-v1.png"],
    ["gameplay.power-up.echo-charge.icon", "gameplay/power-ups/icons/power-echo-charge-v1-20260718-1606.png"],
    ["ui.hud.chain-combo-meter", "ui/hud/chain-combo-meter-v1.png"],
    ["ui.hud.breach-status", "ui/hud/breach-status-badge-v1-20260718-1545.png"],
    ["ui.hud.echo-charge-ready", "ui/hud/echo-charge-ready-badge-v1-20260718-1616.png"],
    ["ui.hud.fuse-heat-meter", "ui/hud/fuse-heat-meter-v1-20260718-1705.png"],
    ["ui.hud.icon.bomb", "ui/hud/icons/hud-icon-bomb.png"],
    ["ui.hud.icon.flame", "ui/hud/icons/hud-icon-flame.png"],
    ["ui.hud.icon.speed", "ui/hud/icons/hud-icon-speed.png"],
    ["ui.hud.icon.remote", "ui/hud/icons/hud-icon-remote.png"],
    ["ui.hud.icon.shield", "ui/hud/icons/hud-icon-shield.png"],
    ["ui.hud.icon.bomb-pass", "ui/hud/icons/hud-icon-bomb-pass.png"],
    ["ui.hud.icon.kick", "ui/hud/icons/hud-icon-kick.png"],
    ["ui.hud.icon.short-fuse", "ui/hud/icons/hud-icon-short-fuse.png"],
    ["ui.hud.icon.ult-ready", "ui/hud/icons/hud-icon-ult-ready.png"],
    ["ui.hud.icon.alive", "ui/hud/icons/hud-icon-alive.png"],
    ["ui.hud.icon.dead", "ui/hud/icons/hud-icon-dead.png"],
    ["ui.hud.frame.rival.normal", "ui/hud/frames/frame-rival-normal.png"],
    ["ui.hud.frame.rival.dead", "ui/hud/frames/frame-rival-dead.png"],
    ["ui.hud.frame.rival.ult-ready", "ui/hud/frames/frame-rival-ult-ready.png"],
    ["ui.hud.frame.local.normal", "ui/hud/frames/frame-local-normal.png"],
    ["ui.hud.frame.local.dead", "ui/hud/frames/frame-local-dead.png"],
    ["ui.hud.frame.local.ult-ready", "ui/hud/frames/frame-local-ult-ready.png"],
    ["ui.hud.frame.match-center", "ui/hud/frames/frame-match-center.png"],
    ["marketing.citadel-breach.key-art", "marketing/citadel-breach-key-art-v1-20260718-1517.png"],
    ["marketing.citadel-breach.launcher-banner", "marketing/citadel-breach-launcher-banner-v1-20260718-1726.png"],
  ] as const)("resolves %s through the root module", (assetId, expectedFileName) => {
    const resolvedUrl = resolveGameAsset(assetId);

    expect(resolvedUrl.split("?")[0]?.replaceAll("\\\\", "/")).toMatch(new RegExp(`/${expectedFileName}$`));
  });

  it("lists every GameAssetId and resolveGameAsset returns a non-empty path for each", () => {
    expect(GAME_ASSET_IDS.length).toBeGreaterThan(50);
    for (const id of GAME_ASSET_IDS) {
      const url = resolveGameAsset(id);
      expect(url, id).toBeTruthy();
      expect(String(url).length, id).toBeGreaterThan(0);
    }
  });

  it("every catalog visual import file exists on disk under game-assets/", () => {
    const imports = catalogImportPaths();
    const bindings = catalogIdToBinding();
    const missing: string[] = [];
    for (const id of GAME_ASSET_IDS) {
      if (id.startsWith("audio.")) continue;
      const binding = bindings.get(id);
      expect(binding, id).toBeTruthy();
      const rel = imports.get(binding!);
      expect(rel, `${id} binding ${binding}`).toBeTruthy();
      const abs = join(GAME_ASSETS_ROOT, rel!);
      if (!existsSync(abs)) missing.push(`${id} -> ${rel}`);
    }
    expect(missing).toEqual([]);
  });

  it("classic power-up icons are not emoji-era 64px placeholders and not legacy archive paths", () => {
    const classicIds = listPowerUpDefinitions().map((d) => d.asset.id as GameAssetId);
    expect(classicIds.length).toBe(8);
    for (const id of classicIds) {
      const url = resolveGameAsset(id);
      const clean = url.split("?")[0]!.replaceAll("\\", "/");
      expect(clean).not.toMatch(/_legacy-emoji/);
      // Vite may serve as absolute file URL or /@fs/ — recover disk path from catalog source
      const imports = catalogImportPaths();
      const bindings = catalogIdToBinding();
      const rel = imports.get(bindings.get(id)!)!;
      const abs = join(GAME_ASSETS_ROOT, rel);
      expect(existsSync(abs), abs).toBe(true);
      const { width, height } = readPngSize(abs);
      expect(width, id).toBeGreaterThanOrEqual(256);
      expect(height, id).toBeGreaterThanOrEqual(256);
      // Must differ from archived emoji file when archive exists
      const legacyName = rel.split("/").pop()!;
      const legacyPath = join(LEGACY_EMOJI_DIR, legacyName);
      if (existsSync(legacyPath)) {
        const live = readFileSync(abs);
        const legacy = readFileSync(legacyPath);
        expect(live.equals(legacy), `${id} still identical to emoji legacy`).toBe(false);
      }
    }
  });

  it("HUD match icons are 512px tournament set under ui/hud/icons/", () => {
    const hudIconIds: GameAssetId[] = [
      "ui.hud.icon.bomb",
      "ui.hud.icon.flame",
      "ui.hud.icon.speed",
      "ui.hud.icon.remote",
      "ui.hud.icon.shield",
      "ui.hud.icon.bomb-pass",
      "ui.hud.icon.kick",
      "ui.hud.icon.short-fuse",
      "ui.hud.icon.ult-ready",
      "ui.hud.icon.alive",
      "ui.hud.icon.dead",
    ];
    const imports = catalogImportPaths();
    const bindings = catalogIdToBinding();
    for (const id of hudIconIds) {
      const rel = imports.get(bindings.get(id)!)!;
      expect(rel).toMatch(/^ui\/hud\/icons\/hud-icon-/);
      const abs = join(GAME_ASSETS_ROOT, rel);
      expect(existsSync(abs), abs).toBe(true);
      const { width, height } = readPngSize(abs);
      expect(width, id).toBeGreaterThanOrEqual(256);
      expect(height, id).toBeGreaterThanOrEqual(256);
      expect(resolveGameAsset(id).length).toBeGreaterThan(0);
    }
    expect(existsSync(join(GAME_ASSETS_ROOT, "ui/hud/icons/MANIFEST.md"))).toBe(true);
    expect(existsSync(join(GAME_ASSETS_ROOT, "ui/hud/icons/_hud-icons-sheet.png"))).toBe(true);
  });

  it("shared gameplay props bomb/flame/crate are high-res Citadel-family PNGs on disk", () => {
    const propIds: GameAssetId[] = [
      "gameplay.bomb.sprite",
      "gameplay.bomb.flame",
      "gameplay.crate.sprite",
      "gameplay.crate.break.0",
      "gameplay.crate.break.1",
      "gameplay.crate.break.2",
      "gameplay.crate.break.3",
    ];
    const imports = catalogImportPaths();
    const bindings = catalogIdToBinding();
    for (const id of propIds) {
      const rel = imports.get(bindings.get(id)!)!;
      const abs = join(GAME_ASSETS_ROOT, rel);
      expect(existsSync(abs), abs).toBe(true);
      const { width, height } = readPngSize(abs);
      expect(width, id).toBeGreaterThanOrEqual(256);
      expect(height, id).toBeGreaterThanOrEqual(256);
      expect(resolveGameAsset(id).length).toBeGreaterThan(0);
    }
  });

  it("documents style contract and visual inventory for keep/new decisions", () => {
    expect(existsSync(join(GAME_ASSETS_ROOT, "STYLE-CONTRACT.md"))).toBe(true);
    expect(existsSync(join(GAME_ASSETS_ROOT, "VISUAL-INVENTORY.md"))).toBe(true);
    expect(existsSync(join(GAME_ASSETS_ROOT, "arenas/THEME-KEEP-LIST.md"))).toBe(true);
    const inv = readFileSync(join(GAME_ASSETS_ROOT, "VISUAL-INVENTORY.md"), "utf8");
    expect(inv).toMatch(/keep/i);
    expect(inv).toMatch(/new/i);
    // Product-loaded branding path must be inventory-listed (AC3)
    expect(inv).toMatch(/brand-mark\.png/);
    expect(inv).toMatch(/product\.brand-mark|product-loaded brand/i);
  });

  it("product-loaded launcher brand mark is Citadel-family high-res PNG, not smooth orange legacy", () => {
    const viewSource = readFileSync(resolve(import.meta.dirname, "../src/app/view.ts"), "utf8");
    const importMatch = viewSource.match(
      /import\s+brandMarkUrl\s+from\s+["'](\.\.\/\.\.\/game-assets\/ui\/branding\/[^"']+)["']/,
    );
    expect(importMatch?.[1]).toBeTruthy();
    const relFromView = importMatch![1]!.replace(/^\.\.\/\.\.\//, "");
    const abs = resolve(import.meta.dirname, "..", relFromView.replace(/\?url$/, ""));
    expect(abs.replaceAll("\\", "/")).toMatch(/game-assets\/ui\/branding\/brand-mark\.png$/);
    expect(existsSync(abs), abs).toBe(true);
    const { width, height } = readPngSize(abs);
    expect(width).toBeGreaterThanOrEqual(256);
    expect(height).toBeGreaterThanOrEqual(256);
    // Differ from archived smooth-orange mark when present
    const legacy = join(GAME_ASSETS_ROOT, "ui/branding/_legacy-smooth-20260719/brand-mark.png");
    if (existsSync(legacy)) {
      expect(readFileSync(abs).equals(readFileSync(legacy))).toBe(false);
    }
    // Inventory marks product brand path as new
    const inv = readFileSync(join(GAME_ASSETS_ROOT, "VISUAL-INVENTORY.md"), "utf8");
    expect(inv).toMatch(/ui\/branding\/brand-mark\.png[\s\S]*?\bnew\b|`product\.brand-mark`[\s\S]*?\bnew\b/i);
  });
});
