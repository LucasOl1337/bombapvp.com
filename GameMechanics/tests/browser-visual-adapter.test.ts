import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "GameMechanics");
const BROWSER_MAIN = join(ROOT, "src", "browser", "main.ts");
const BROWSER_STYLES = join(ROOT, "src", "browser", "styles.css");
const BROWSER_PACKS = join(ROOT, "src", "browser", "champion-packs.ts");
const INDEX_HTML = join(ROOT, "index.html");
const ASSETS_DIR = join(ROOT, "assets");
const RANNI_SPIRIT_WISP = join(
  process.cwd(),
  "Champions",
  "ranni",
  "assets",
  "animations",
  "spirit-wisp-strip.png",
);

// Case-sensitive: local arena copies live under assets/ (lowercase).
// Character sprites may come from Champions/ (mode-4 roster).
const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["'][^"']*src\/original-game/,
  /from\s+["'][^"']*game-assets\//,
  /from\s+["'][^"']*public\/Assets/,
  /from\s+["']@\//,
];

const REQUIRED_LOCAL_ASSETS = [
  "arena/tournament-clean/floor-base.png",
  "arena/tournament-clean/floor-lane.png",
  "arena/tournament-clean/floor-spawn.png",
  "arena/tournament-clean/floor-portal.png",
  "arena/tournament-clean/wall.png",
  "arena/tournament-clean/crate.png",
  "gameplay/bomb.png",
  "gameplay/flame.png",
  "gameplay/power-bomb.png",
  "gameplay/power-flame.png",
  "gameplay/crate-break-0.png",
  "gameplay/crate-break-3.png",
  "audio/bombs/bomb_place.mp3",
  "audio/bombs/bomb_explode_main.mp3",
  "audio/bombs/flames.mp3",
  "audio/match/sudden_death_alarm.wav",
  "audio/power-ups/powerup_collect.mp3",
  "brand/brand-mark.png",
  "hud/icon-bomb-v1.png",
  "hud/icon-flame-v1.png",
] as const;

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

describe("browser visual adapter (product arena)", () => {
  it("ships required product assets inside GameMechanics/assets", () => {
    for (const rel of REQUIRED_LOCAL_ASSETS) {
      const path = join(ASSETS_DIR, rel);
      expect(existsSync(path), `missing local asset: ${rel}`).toBe(true);
    }
  });

  it("browser sources do not import original-game / shared asset roots", () => {
    const main = readFileSync(BROWSER_MAIN, "utf8");
    const styles = readFileSync(BROWSER_STYLES, "utf8");
    const packs = readFileSync(BROWSER_PACKS, "utf8");
    const combined = `${main}\n${styles}\n${packs}`;

    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      expect(combined, `forbidden import matched ${pattern}`).not.toMatch(pattern);
    }

    // Mode 4 roster is loaded from Champions content pack.
    expect(packs).toMatch(/Champions\/(assets-catalog|catalog|membership)/);
    expect(main).toContain("champion-packs");
    expect(main).toContain("hud/icon-bomb-v1.png");
    expect(main).toContain("hud/icon-flame-v1.png");
    expect(main).toMatch(/hudBombIconUrl|icon-bomb-v1/);
    expect(main).toMatch(/hudFlameIconUrl|icon-flame-v1/);
  });

  it("keeps champion accent channels compatible with CSS slash-alpha colors", () => {
    const main = readFileSync(BROWSER_MAIN, "utf8");
    const accentBlock = main.match(
      /const ACCENT_RGB[\s\S]*?Object\.freeze\(\{([\s\S]*?)\}\);/,
    );

    expect(accentBlock, "ACCENT_RGB declaration not found").not.toBeNull();
    const accentSource = accentBlock?.[1] ?? "";
    const accents = Object.fromEntries(
      [...accentSource.matchAll(/^\s*(blue|gold|green|red|orange):\s*"([^"]+)"/gm)].map(
        ([, name, channels]) => [name, channels],
      ),
    );

    expect(Object.keys(accents).sort()).toEqual(["blue", "gold", "green", "orange", "red"]);
    for (const [name, channels] of Object.entries(accents)) {
      expect(channels, `${name} must use space-separated RGB channels`).toMatch(
        /^\d{1,3} \d{1,3} \d{1,3}$/,
      );
    }
    expect(main).toMatch(/`rgb\(\$\{accent\} \/ \$\{/);
  });

  it("default presentation is product arena, not diagnostic dashboard", () => {
    const main = readFileSync(BROWSER_MAIN, "utf8");
    const styles = readFileSync(BROWSER_STYLES, "utf8");
    const html = readFileSync(INDEX_HTML, "utf8");

    // Product shell markers
    expect(main).toContain("arena-app");
    expect(main).toContain("arena-hud");
    expect(main).toContain("arena-timer-shell");
    expect(main).toContain("arena-player-card");
    expect(main).toContain("arena-hud__bar");
    expect(styles).toContain(".arena-app");
    expect(styles).toContain(".arena-hud");
    expect(styles).toContain(".arena-hud__bar");

    // LoL dual HUD + character select
    expect(main).toContain("lol-hud");
    expect(main).toContain("char-select");
    expect(main).toContain("listChampionPresentations");
    expect(main).toContain("createLolHudPanel");
    expect(styles).toContain(".lol-hud");
    expect(styles).toContain(".char-select");
    expect(styles).toContain(".lol-hud--p1");
    expect(styles).toContain(".lol-hud--p2");

    // Diagnostic dashboard removed from default markup construction
    expect(main).not.toContain("mechanics-sidebar");
    expect(main).not.toContain("mechanics-layout");
    expect(main).not.toContain('className, "mechanics-shell"');
    expect(main).not.toContain("mechanics-eyebrow");
    expect(main).not.toContain("Eventos da simulação");
    expect(main).not.toContain("Estado da partida");
    expect(html).not.toMatch(/>\s*GameMechanics\s*</);
    expect(html).not.toContain("Carregando GameMechanics");

    // Dev panel exists but starts closed unless ?dev=1; toggle lives in dock (not absolute over rival).
    expect(main).toContain("isDevQueryEnabled");
    expect(main).toContain('get("dev") === "1"');
    expect(main).toContain("arena-dev");
    expect(main).toMatch(/dock\.append\([\s\S]*devToggle/);
    expect(styles).toContain(".arena-dev");
    expect(styles).toMatch(/\.arena-dev\s*\{[^}]*display:\s*none/s);
    expect(styles).toMatch(/\.arena-dev-toggle\s*\{[^}]*position:\s*static/s);

    // Diagnostic hooks preserved
    expect(main).toContain("get_game_mechanics_snapshot");
    expect(main).toContain("advance_game_mechanics");

    // Controls preserved
    expect(main).toContain("KeyW");
    expect(main).toContain("KeyQ");
    expect(main).toContain("KeyR");
    expect(main).toContain("KeyE");
    expect(main).toContain("ArrowUp");
    expect(main).toContain("KeyO");
    expect(main).toContain("KeyP");
    expect(main).toContain('type: "use-skill"');
    expect(main).toMatch(/lol-hud__spell--r|hud-ult/);
    expect(main).toContain("Escape");
    expect(main).toContain("KeyT");
  });

  it("presents the AI laboratory on the landing surface and routes bots through selected profiles", () => {
    const main = readFileSync(BROWSER_MAIN, "utf8");
    const styles = readFileSync(BROWSER_STYLES, "utf8");
    const matchMode = readFileSync(join(ROOT, "src", "browser", "match-mode.ts"), "utf8");
    const botDrivers = readFileSync(join(ROOT, "src", "browser", "bot-drivers.ts"), "utf8");

    expect(main).toContain('id: "local-duel"');
    expect(main).toContain('id: "bot-training"');
    expect(main).toContain('id: "bot-lab"');
    expect(main).toContain("Laboratório de IA");
    expect(main).toContain("AI laboratory");
    expect(main).toContain("char-select__modes");
    expect(main).toContain("BOT_PROFILES");
    expect(styles).toContain(".char-select__mode");
    expect(styles).toContain(".char-select__profile");

    expect(matchMode).toContain("BrowserMatchConfiguration");
    expect(matchMode).toContain("parseBrowserLaunchState");
    expect(matchMode).toContain("serializeBrowserMatchConfiguration");
    expect(botDrivers).toMatch(/driveBot[\s\S]*driver\.profile/);
    expect(main).toContain("driveBrowserBotsForTick");
  });

  it("layout contracts prevent canvas shrink-to-fit and HUD stack clipping", () => {
    const main = readFileSync(BROWSER_MAIN, "utf8");
    const styles = readFileSync(BROWSER_STYLES, "utf8");

    // Stage is a size container; frame width is explicit from free area (cqw/cqh), not canvas intrinsic.
    expect(styles).toMatch(/\.arena-stage\s*\{[^}]*container-type:\s*size/s);
    expect(styles).toMatch(
      /\.arena-canvas-frame\s*\{[^}]*width:\s*min\(\s*100cqw\s*,\s*calc\(\s*\(?\s*100cqh/s,
    );
    expect(styles).toMatch(/100cqh[\s\S]{0,40}\*\s*11\s*\/\s*9/);
    expect(styles).toMatch(/\.arena-canvas\s*\{[^}]*width:\s*100%/s);
    expect(styles).toMatch(/\.arena-canvas\s*\{[^}]*height:\s*100%/s);

    // Anti-regression: the original shrink-to-fit loop that locked canvas at 528×432.
    expect(styles).not.toMatch(
      /\.arena-canvas\s*\{[^}]*width:\s*min\(\s*100%\s*,\s*calc\(\s*\(100dvh/s,
    );
    expect(styles).not.toMatch(
      /\.arena-canvas-frame\s*\{[^}]*max-width:\s*min\(\s*100%\s*,\s*calc\(\s*\(100dvh/s,
    );

    // HUD stays a single horizontal bar — P1 | timer | P2.
    expect(styles).toContain(".arena-hud__bar");
    expect(styles).toMatch(
      /\.arena-hud__bar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/s,
    );
    expect(styles).not.toMatch(
      /@media\s*\(\s*max-width:\s*900px\s*\)\s*\{[^}]*\.arena-hud\s*\{[^}]*grid-template-columns:\s*1fr/s,
    );

    // Champion source-rect trim + height scale (not full-frame padding scale).
    expect(main).toContain("getSpriteTrimBounds");
    expect(main).toContain("CHAMPION_HEIGHT_TILES");
    expect(main).toContain("BODY_HALF_EXTENT");
    expect(main).toMatch(/drawImage\(\s*image\s*,\s*srcX\s*,\s*srcY\s*,\s*srcW\s*,\s*srcH/);

    // Character presentation polish: accent plate + silhouette glow on light stone.
    expect(main).toContain("ACCENT_RGB");
    expect(main).toContain("accentRgb");
    expect(main).toContain("Accent ground plate");
    expect(main).toContain("Soft accent silhouette glow");
    expect(main).toMatch(/shadowBlur/);

    // Presentation-only feedback for power-ups and sudden death.
    expect(main).toContain("power-up-revealed");
    expect(main).toContain("power-up-collected");
    expect(main).toContain("presentationFx");
    expect(main).toContain("arena-sd-banner");
    expect(styles).toContain(".arena-sd-banner");

    // Pause must not enqueue movement/bomb; gate to playing | sudden-death.
    expect(main).toContain("acceptsGameplayInput");
    expect(main).toMatch(
      /function acceptsGameplayInput[\s\S]*phase === "playing"[\s\S]*phase === "sudden-death"/,
    );
    expect(main).toMatch(/if\s*\(\s*!acceptsGameplayInput\(\)\s*\)\s*return/);
    // Bomb gate appears (place-bomb path).
    const bombKeyIdx = main.lastIndexOf('event.code === "KeyQ"');
    expect(bombKeyIdx).toBeGreaterThan(-1);
    const bombGateBlock = main.slice(bombKeyIdx, bombKeyIdx + 500);
    expect(bombGateBlock).toContain("acceptsGameplayInput");
    expect(bombGateBlock).toContain("place-bomb");
    // Movement release when leaving playable phase.
    expect(main).toContain("releaseMovement");
    expect(main).toMatch(/!acceptsGameplayInput\(snapshot\.phase\)[\s\S]{0,80}releaseMovement/);
  });

  it("presents Ice Blink as a frozen body plus a wall-phasing spirit", () => {
    const main = readFileSync(BROWSER_MAIN, "utf8");

    expect(main).toContain("RANNI_FROZEN_ULTIMATE_FRAME");
    expect(main).toContain("ranniProjectionPose");
    expect(main).toContain("spectral: true");
    expect(main).toContain("Spectral projection");
    expect(main).not.toContain("Ice Blink soul tether");
    expect(main).toContain("RANNI_SPIRIT_PRIMARY_ALPHA");
    expect(existsSync(RANNI_SPIRIT_WISP)).toBe(true);
    expect(main).toContain("RANNI_FREEZE_BUILD_MS");
    expect(main).toMatch(/Math\.floor\(age \/ \(timed\.buildMs \/ frames\.length\)\)/);
    expect(main).not.toContain("holdFrameIndex");
  });

  it("does not tree-walk into legacy original-game asset roots", () => {
    const sources = walkFiles(join(ROOT, "src", "browser"))
      .filter((f) => f.endsWith(".ts") || f.endsWith(".css"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/original-game|game-assets\/|public\/Assets/);
    // relative imports stay inside GameMechanics browser or Champions pack
    const rel = relative(ROOT, BROWSER_MAIN);
    expect(rel.replace(/\\/g, "/")).toBe("src/browser/main.ts");
  });
});
