import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "GameMechanics");
const BROWSER_MAIN = join(ROOT, "src", "browser", "main.ts");
const BROWSER_STYLES = join(ROOT, "src", "browser", "styles.css");
const INDEX_HTML = join(ROOT, "index.html");
const ASSETS_DIR = join(ROOT, "assets");

// Case-sensitive: local copies live under assets/champions/ (lowercase).
const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["'][^"']*src\/original-game/,
  /from\s+["'][^"']*\/Champions\//,
  /from\s+["'][^"']*game-assets\//,
  /from\s+["'][^"']*public\/Assets/,
  /from\s+["']@\//,
  /from\s+["']\.\.\/\.\.\/\.\.\//, // outside GameMechanics
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
  "champions/ranni/idle-south-0.png",
  "champions/ranni/walk-south-0.png",
  "champions/ranni/cast-south-0.png",
  "champions/ranni/death-south-0.png",
  "champions/ranni/death-south-6.png",
  "champions/ranni/portrait.png",
  "champions/nico/idle-south-0.png",
  "champions/nico/walk-south-0.png",
  "champions/nico/cast-south-0.png",
  "champions/nico/death-south-0.png",
  "champions/nico/death-south-5.png",
  "champions/nico/portrait.png",
  "gameplay/crate-break-0.png",
  "gameplay/crate-break-3.png",
  "audio/bombs/bomb_place.mp3",
  "audio/bombs/bomb_explode_main.mp3",
  "audio/bombs/flames.mp3",
  "audio/match/sudden_death_alarm.wav",
  "audio/power-ups/powerup_collect.mp3",
  "brand/brand-mark.png",
  "hud/panel-center-v1.png",
  "hud/panel-local-v1.png",
  "hud/panel-rival-v1.png",
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

  it("browser sources only import assets under GameMechanics/assets", () => {
    const main = readFileSync(BROWSER_MAIN, "utf8");
    const styles = readFileSync(BROWSER_STYLES, "utf8");
    const combined = `${main}\n${styles}`;

    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      expect(combined, `forbidden import matched ${pattern}`).not.toMatch(pattern);
    }

    const assetImports = [...main.matchAll(/from\s+["']([^"']+\.(?:png|svg|webp|jpg))["']/g)].map(
      (m) => m[1]!,
    );
    expect(assetImports.length).toBeGreaterThan(20);
    for (const spec of assetImports) {
      expect(spec.startsWith("../../assets/"), `non-local asset import: ${spec}`).toBe(true);
    }

    // Metallic HUD chrome must be real runtime imports — not dead files on disk.
    expect(main).toContain("hud/panel-center-v1.png");
    expect(main).toContain("hud/panel-local-v1.png");
    expect(main).toContain("hud/panel-rival-v1.png");
    expect(main).toMatch(/hudPanelCenterUrl|panel-center-v1/);
    expect(main).toMatch(/--hud-panel-local|--hud-panel-center|--hud-panel-rival/);
    expect(styles).toContain("var(--hud-panel-local)");
    expect(styles).toContain("var(--hud-panel-rival)");
    expect(styles).toContain("var(--hud-panel-center)");
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
    expect(main).toContain("KeyE");
    expect(main).toContain("ArrowUp");
    expect(main).toContain("KeyO");
    expect(main).toContain("KeyP");
    expect(main).toContain('type: "use-skill"');
    expect(main).toContain("arena-player-card__skill");
    expect(main).toContain("Escape");
    expect(main).toContain("KeyT");
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

    // HUD stays a single horizontal bar — no multi-row stack that steals arena height at ≤900px.
    expect(styles).toContain(".arena-hud__bar");
    expect(styles).not.toMatch(
      /@media\s*\(\s*max-width:\s*900px\s*\)\s*\{[^}]*\.arena-hud\s*\{[^}]*grid-template-columns:\s*1fr/s,
    );

    // Champion source-rect trim + height scale (not full-frame padding scale).
    expect(main).toContain("getSpriteTrimBounds");
    expect(main).toContain("CHAMPION_HEIGHT_TILES");
    expect(main).toContain("BODY_HALF_EXTENT");
    expect(main).toMatch(/drawImage\(\s*image\s*,\s*srcX\s*,\s*srcY\s*,\s*srcW\s*,\s*srcH/);

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
    const bombGateBlock = main.slice(
      main.indexOf('event.code === "KeyQ"'),
      main.indexOf('event.code === "Escape"'),
    );
    expect(bombGateBlock).toContain("acceptsGameplayInput");
    // Movement release when leaving playable phase.
    expect(main).toContain("releaseMovement");
    expect(main).toMatch(/!acceptsGameplayInput\(snapshot\.phase\)[\s\S]{0,80}releaseMovement/);
  });

  it("does not tree-walk into legacy asset roots at runtime import time", () => {
    const sources = walkFiles(join(ROOT, "src", "browser"))
      .filter((f) => f.endsWith(".ts") || f.endsWith(".css"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/original-game|Champions\/|game-assets\/|public\/Assets/);
    // relative imports stay inside GameMechanics
    const rel = relative(ROOT, BROWSER_MAIN);
    expect(rel.replace(/\\/g, "/")).toBe("src/browser/main.ts");
  });
});
