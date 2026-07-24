/**
 * One competitor's HUD panel: its markup, its identity, and its per-frame state.
 *
 * The arena used to build these nodes at module top level and then reach back
 * into ~20 captured element references every frame. Construction and lifecycle
 * were the same code, so neither could run without the other — and neither
 * could be exercised without booting the whole renderer.
 *
 * Here they are one module with two verbs: `paintIdentity` (who this seat is)
 * and `update` (what that seat is doing this frame). The element references stay
 * inside; callers only ever hold `root` and the two verbs.
 *
 * The DOM is injected rather than imported, so the module can be driven from a
 * test document without a canvas, a kernel, or a clock.
 */

/** Which seat this panel draws — decides side classes and the spell key. */
export type HudPanelSide = "p1" | "p2";

/** Identity fields the panel reads off the selected champion. */
export type HudPanelChampion = Readonly<{
  accent: string;
  portrait: string;
  name: string;
  skillName: string;
  /** Null when the seat's champion has no kernel skill — the spell reads locked. */
  kernelSkillId: string | null;
  /** 0 falls back to `fallbackCooldownMs`, so the ring still sweeps. */
  skillCooldownMs: number;
}>;

/** Who is driving this seat, already worded by the arena in its own language. */
export type HudPanelController = Readonly<{ label: string; isBot: boolean }>;

/** Just the strings this panel prints. Keeps the arena's full copy out. */
export type HudPanelCopy = Readonly<{
  rivalOut: string;
  protected: string;
  ultReady: string;
  ultCast: string;
  skillCooldown: (seconds: number) => string;
}>;

/**
 * What the panel needs from a tick, flattened.
 *
 * Deliberately not the kernel snapshot: the panel should not know how to find a
 * competitor in it, and a test should not have to build one to check a pip.
 */
export type HudPanelState = Readonly<{
  alive: boolean;
  maxBombs: number;
  activeBombs: number;
  flameRange: number;
  spawnProtectionRemainingMs: number;
  /** Rounds this competitor has won, drawn as filled pips. */
  wins: number;
  targetRoundWins: number;
  /** Null when the seat has no skill at all — distinct from a skill on cooldown. */
  skill: Readonly<{ phase: "idle" | "channeling" | "cooldown"; cooldownRemainingMs: number }> | null;
}>;

export type HudPanelDeps = Readonly<{
  document: Document;
  side: HudPanelSide;
  /** Icon URLs, resolved by the bundler in the arena and stubbed in tests. */
  bombIconUrl: string;
  flameIconUrl: string;
  copy: HudPanelCopy;
  /** Used when a champion reports no cooldown of its own. */
  fallbackCooldownMs: number;
}>;

export type HudPanel = ReturnType<typeof createHudPanel>;

/** Health-bar fill for a competitor: full, shielded, or gone. */
function vitalityFraction(state: HudPanelState): number {
  if (!state.alive) return 0;
  return state.spawnProtectionRemainingMs > 0 ? 0.7 : 1;
}

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createHudPanel(deps: HudPanelDeps) {
  const { document, side, copy } = deps;
  const bombKey = side === "p1" ? "Q" : "O";
  const skillKey = side === "p1" ? "R" : "I";

  const root = element(
    document,
    "div",
    `arena-player-card arena-player-card--${side} lol-hud lol-hud--${side}`,
  );
  root.dataset.slot = side;

  const portraitWrap = element(document, "div", "lol-hud__portrait-wrap");
  const portraitRing = element(document, "div", "lol-hud__portrait-ring");
  const portrait = document.createElement("img");
  portrait.className = "lol-hud__portrait";
  portrait.alt = "";
  portrait.decoding = "async";
  portraitWrap.append(portraitRing, portrait);

  const body = element(document, "div", "lol-hud__body");
  const header = element(document, "div", "lol-hud__header");
  const tag = element(document, "span", "lol-hud__tag", side === "p1" ? "P1" : "P2");
  const name = element(document, "span", "lol-hud__name", "");
  const pips = element(document, "div", "lol-hud__pips hud-pips");
  header.append(tag, name, pips);
  const controller = element(document, "div", "lol-hud__controller", "");

  const statusRow = element(document, "div", "lol-hud__status-row");
  const statusBar = element(document, "div", "lol-hud__hp");
  const statusBarFill = element(document, "span", "lol-hud__hp-fill");
  statusBarFill.style.width = "100%";
  statusBar.append(statusBarFill);
  const status = element(document, "span", "lol-hud__status", "");
  statusRow.append(statusBar, status);

  const skillName = element(document, "div", "lol-hud__skill-name", "");

  const powerRail = element(document, "div", "lol-hud__power hud-power");
  const bombChip = element(document, "span", "hud-power__chip");
  const bombIcon = document.createElement("img");
  bombIcon.src = deps.bombIconUrl;
  bombIcon.alt = "";
  const bombs = element(document, "span", "hud-power__value", "1/1");
  bombChip.append(bombIcon, bombs);
  const flameChip = element(document, "span", "hud-power__chip");
  const flameIcon = document.createElement("img");
  flameIcon.src = deps.flameIconUrl;
  flameIcon.alt = "";
  const range = element(document, "span", "hud-power__value", "1");
  flameChip.append(flameIcon, range);
  powerRail.append(bombChip, flameChip);

  const spells = element(document, "div", "lol-hud__spells");
  const spellQ = element(document, "div", "lol-hud__spell lol-hud__spell--q");
  spellQ.title = `${bombKey} · Bomba`;
  spellQ.append(element(document, "span", "lol-hud__spell-key", bombKey));
  const spellQIcon = document.createElement("img");
  spellQIcon.src = deps.bombIconUrl;
  spellQIcon.alt = "";
  spellQ.append(spellQIcon);

  const spellR = element(document, "div", "lol-hud__spell lol-hud__spell--r is-ready");
  spellR.append(element(document, "span", "lol-hud__spell-key", skillKey));
  const spellRLabel = element(document, "span", "lol-hud__spell-label", "");
  const spellRCd = element(document, "span", "lol-hud__spell-cd", "");
  spellR.append(spellRLabel, spellRCd);
  spells.append(spellQ, spellR);

  body.append(header, controller, statusRow, skillName, powerRail, spells);
  root.append(portraitWrap, body);

  /**
   * Who this seat is: champion art, names, and who is driving it.
   *
   * Called on boot and again whenever the pick or the controller changes, so it
   * must be idempotent — nothing here accumulates.
   */
  function paintIdentity(champion: HudPanelChampion, controller: HudPanelController): void {
    root.dataset.accent = champion.accent;
    portrait.src = champion.portrait;
    name.textContent = champion.name;
    skillName.textContent = champion.skillName;
    spellR.title = `${skillKey} · ${champion.skillName}`;
    spellRLabel.textContent = champion.skillName.slice(0, 1).toUpperCase();
    spellR.classList.toggle("is-locked", !champion.kernelSkillId);
    setController(controller);
  }

  /**
   * Driver readout. `isBot` arrives as a flag rather than being parsed out of
   * the label, so the panel never has to know how the arena words "HUMAN" in
   * either language.
   */
  function setController(driver: HudPanelController): void {
    controller.textContent = driver.label;
    root.classList.toggle("is-bot-controlled", driver.isBot);
  }

  /** Brief pulse on the power chip that just grew (pickup feedback). */
  function pulseStat(powerUpType: "bomb-up" | "flame-up"): void {
    const target = powerUpType === "bomb-up" ? bombChip : flameChip;
    target.classList.remove("is-pulsed");
    void target.offsetWidth;
    target.classList.add("is-pulsed");
  }

  /** This frame's numbers. Pure read of `state` — no snapshot lookups here. */
  function update(state: HudPanelState, champion: HudPanelChampion): void {
    root.classList.toggle("is-eliminated", !state.alive);
    bombs.textContent =
      `${Math.max(0, state.maxBombs - state.activeBombs)}/${state.maxBombs}`;
    range.textContent = String(state.flameRange);
    status.textContent = !state.alive
      ? copy.rivalOut
      : state.spawnProtectionRemainingMs > 0
        ? copy.protected
        : "";
    statusBarFill.style.width = `${Math.round(vitalityFraction(state) * 100)}%`;
    statusBarFill.classList.toggle("is-down", !state.alive);
    statusBarFill.classList.toggle("is-shield", state.spawnProtectionRemainingMs > 0);

    const pipNodes: HTMLElement[] = [];
    for (let i = 0; i < state.targetRoundWins; i += 1) {
      pipNodes.push(element(
        document,
        "span",
        i < state.wins ? "hud-pips__pip hud-pips__pip--filled" : "hud-pips__pip",
      ));
    }
    pips.replaceChildren(...pipNodes);

    spellR.classList.remove("is-locked");
    if (!state.skill) {
      // A seat with no skill at all: locked, and the ring reads full rather than
      // sweeping, so it cannot be mistaken for a cooldown about to end.
      spellR.classList.add("is-locked");
      spellR.classList.remove("is-ready", "is-cast", "is-cooldown");
      spellRCd.textContent = "";
      portraitRing.style.setProperty("--cd", "1");
      return;
    }

    const phase = state.skill.phase === "idle"
      ? "ready"
      : state.skill.phase === "channeling"
        ? "cast"
        : "cooldown";
    spellR.classList.toggle("is-ready", phase === "ready");
    spellR.classList.toggle("is-cast", phase === "cast");
    spellR.classList.toggle("is-cooldown", phase === "cooldown");
    spellRCd.textContent = phase === "ready"
      ? copy.ultReady
      : phase === "cast"
        ? copy.ultCast
        : copy.skillCooldown(state.skill.cooldownRemainingMs / 1_000);

    const cooldownMs = champion.skillCooldownMs || deps.fallbackCooldownMs;
    const progress = phase === "ready" || phase === "cast"
      ? 1
      : 1 - Math.min(1, Math.max(0, state.skill.cooldownRemainingMs / cooldownMs));
    portraitRing.style.setProperty("--cd", String(progress));
  }

  return { root, paintIdentity, setController, pulseStat, update };
}
