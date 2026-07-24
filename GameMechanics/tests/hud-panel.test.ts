import { describe, expect, it } from "vitest";
import {
  createHudPanel,
  type HudPanelChampion,
  type HudPanelSide,
  type HudPanelState,
} from "../src/browser/hud-panel.ts";

/**
 * The panel takes its `Document` as a dependency, so these tests drive it
 * through a fake one — no happy-dom, no canvas, no kernel. That injection is
 * the whole point of the split: HUD rules are now readable through an
 * interface instead of only by booting the arena.
 */

type FakeNode = {
  tagName: string;
  className: string;
  textContent: string;
  title: string;
  alt: string;
  src: string;
  decoding: string;
  offsetWidth: number;
  children: FakeNode[];
  dataset: Record<string, string>;
  classList: {
    add: (...names: string[]) => void;
    remove: (...names: string[]) => void;
    toggle: (name: string, force?: boolean) => void;
    contains: (name: string) => boolean;
  };
  style: { width: string; setProperty: (key: string, value: string) => void };
  props: Record<string, string>;
  append: (...nodes: FakeNode[]) => void;
  replaceChildren: (...nodes: FakeNode[]) => void;
};

function fakeDocument(): Document {
  function createElement(tagName: string): FakeNode {
    const classes = new Set<string>();
    const node: FakeNode = {
      tagName,
      textContent: "",
      title: "",
      alt: "",
      src: "",
      decoding: "",
      offsetWidth: 0,
      children: [],
      dataset: {},
      props: {},
      style: {
        width: "",
        setProperty: (key, value) => { node.props[key] = value; },
      },
      classList: {
        add: (...names) => { for (const name of names) classes.add(name); },
        remove: (...names) => { for (const name of names) classes.delete(name); },
        toggle: (name, force) => {
          const on = force ?? !classes.has(name);
          if (on) classes.add(name);
          else classes.delete(name);
        },
        contains: (name) => classes.has(name),
      },
      get className(): string {
        return [...classes].join(" ");
      },
      set className(value: string) {
        classes.clear();
        for (const part of value.split(/\s+/).filter(Boolean)) classes.add(part);
      },
      append: (...nodes) => { node.children.push(...nodes); },
      replaceChildren: (...nodes) => { node.children = [...nodes]; },
    };
    return node;
  }
  return { createElement } as unknown as Document;
}

/** Depth-first walk; the panel's tree is small enough that this is honest. */
function descendants(node: FakeNode): FakeNode[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

function find(root: unknown, className: string): FakeNode {
  const node = descendants(root as FakeNode).find((entry) =>
    entry.classList.contains(className),
  );
  if (!node) throw new Error(`no node with class ${className}`);
  return node;
}

const COPY = Object.freeze({
  rivalOut: "FORA",
  protected: "ESCUDO",
  ultReady: "PRONTA",
  ultCast: "CAST",
  skillCooldown: (seconds: number) => `${seconds.toFixed(1)}s`,
});

const CHAMPION: HudPanelChampion = Object.freeze({
  accent: "blue",
  portrait: "ranni.png",
  name: "Ranni",
  skillName: "Ice Blink",
  kernelSkillId: "ranni-ice-blink",
  skillCooldownMs: 10_000,
});

function panelFor(side: HudPanelSide = "p1") {
  return createHudPanel({
    document: fakeDocument(),
    side,
    bombIconUrl: "bomb.png",
    flameIconUrl: "flame.png",
    copy: COPY,
    fallbackCooldownMs: 8_000,
  });
}

function state(overrides: Partial<HudPanelState> = {}): HudPanelState {
  return {
    alive: true,
    maxBombs: 2,
    activeBombs: 0,
    flameRange: 3,
    spawnProtectionRemainingMs: 0,
    wins: 0,
    targetRoundWins: 2,
    skill: { phase: "idle", cooldownRemainingMs: 0 },
    ...overrides,
  };
}

describe("HUD panel — identity", () => {
  it("paints the champion and marks a bot-driven seat", () => {
    const panel = panelFor();
    panel.paintIdentity(CHAMPION, { label: "IA · Bomb", isBot: true });
    expect(find(panel.root, "lol-hud__name").textContent).toBe("Ranni");
    expect(find(panel.root, "lol-hud__skill-name").textContent).toBe("Ice Blink");
    expect(find(panel.root, "lol-hud__portrait").src).toBe("ranni.png");
    expect((panel.root as unknown as { dataset: Record<string, string> }).dataset.accent)
      .toBe("blue");
    expect(panel.root.classList.contains("is-bot-controlled")).toBe(true);
  });

  it("clears the bot marker when a human takes the seat back", () => {
    const panel = panelFor();
    panel.paintIdentity(CHAMPION, { label: "IA · Bomb", isBot: true });
    panel.paintIdentity(CHAMPION, { label: "HUMANO", isBot: false });
    expect(panel.root.classList.contains("is-bot-controlled")).toBe(false);
    expect(find(panel.root, "lol-hud__controller").textContent).toBe("HUMANO");
  });

  it("locks the spell for a champion with no kernel skill", () => {
    const panel = panelFor();
    panel.paintIdentity({ ...CHAMPION, kernelSkillId: null }, { label: "HUMANO", isBot: false });
    expect(find(panel.root, "lol-hud__spell--r").classList.contains("is-locked")).toBe(true);
  });

  it("binds the second seat to its own keys", () => {
    const p2 = panelFor("p2");
    p2.paintIdentity(CHAMPION, { label: "HUMANO", isBot: false });
    const keys = descendants(p2.root as unknown as FakeNode)
      .filter((node) => node.classList.contains("lol-hud__spell-key"))
      .map((node) => node.textContent);
    expect(keys).toEqual(["O", "I"]);
  });
});

describe("HUD panel — per-frame state", () => {
  it("counts bombs as remaining over total", () => {
    const panel = panelFor();
    panel.update(state({ maxBombs: 3, activeBombs: 2 }), CHAMPION);
    expect(find(panel.root, "hud-power__value").textContent).toBe("1/3");
  });

  it("reads an eliminated competitor as out, with an empty bar", () => {
    const panel = panelFor();
    panel.update(state({ alive: false }), CHAMPION);
    expect(find(panel.root, "lol-hud__status").textContent).toBe("FORA");
    expect(find(panel.root, "lol-hud__hp-fill").style.width).toBe("0%");
    expect(panel.root.classList.contains("is-eliminated")).toBe(true);
  });

  it("shows spawn protection as a shielded, partial bar", () => {
    const panel = panelFor();
    panel.update(state({ spawnProtectionRemainingMs: 500 }), CHAMPION);
    const fill = find(panel.root, "lol-hud__hp-fill");
    expect(find(panel.root, "lol-hud__status").textContent).toBe("ESCUDO");
    expect(fill.classList.contains("is-shield")).toBe(true);
    expect(fill.style.width).toBe("70%");
  });

  it("draws one pip per target win and fills the ones already earned", () => {
    const panel = panelFor();
    panel.update(state({ wins: 1, targetRoundWins: 3 }), CHAMPION);
    const pips = find(panel.root, "hud-pips").children;
    expect(pips).toHaveLength(3);
    expect(pips.filter((pip) => pip.classList.contains("hud-pips__pip--filled"))).toHaveLength(1);
  });

  it("replaces pips rather than accumulating them across frames", () => {
    const panel = panelFor();
    panel.update(state({ wins: 0, targetRoundWins: 2 }), CHAMPION);
    panel.update(state({ wins: 2, targetRoundWins: 2 }), CHAMPION);
    expect(find(panel.root, "hud-pips").children).toHaveLength(2);
  });

  it("sweeps the portrait ring in proportion to the cooldown left", () => {
    const panel = panelFor();
    panel.update(
      state({ skill: { phase: "cooldown", cooldownRemainingMs: 2_500 } }),
      CHAMPION,
    );
    const ring = find(panel.root, "lol-hud__portrait-ring");
    expect(Number(ring.props["--cd"])).toBeCloseTo(0.75, 5);
    expect(find(panel.root, "lol-hud__spell-cd").textContent).toBe("2.5s");
  });

  it("falls back to the injected cooldown when the champion reports none", () => {
    const panel = panelFor();
    panel.update(
      state({ skill: { phase: "cooldown", cooldownRemainingMs: 4_000 } }),
      { ...CHAMPION, skillCooldownMs: 0 },
    );
    // 4000 of the 8000 ms fallback still to run.
    expect(Number(find(panel.root, "lol-hud__portrait-ring").props["--cd"])).toBeCloseTo(0.5, 5);
  });

  it("reads a full ring while ready or casting, never a partial sweep", () => {
    const panel = panelFor();
    for (const phase of ["idle", "channeling"] as const) {
      panel.update(state({ skill: { phase, cooldownRemainingMs: 9_999 } }), CHAMPION);
      expect(find(panel.root, "lol-hud__portrait-ring").props["--cd"]).toBe("1");
    }
    expect(find(panel.root, "lol-hud__spell-cd").textContent).toBe("CAST");
  });

  it("locks a seat with no skill instead of leaving a stale cooldown on screen", () => {
    const panel = panelFor();
    panel.update(state({ skill: { phase: "cooldown", cooldownRemainingMs: 5_000 } }), CHAMPION);
    panel.update(state({ skill: null }), CHAMPION);
    const spell = find(panel.root, "lol-hud__spell--r");
    expect(spell.classList.contains("is-locked")).toBe(true);
    expect(spell.classList.contains("is-cooldown")).toBe(false);
    expect(find(panel.root, "lol-hud__spell-cd").textContent).toBe("");
    expect(find(panel.root, "lol-hud__portrait-ring").props["--cd"]).toBe("1");
  });

  it("pulses only the chip whose stat grew", () => {
    const panel = panelFor();
    panel.pulseStat("flame-up");
    const chips = descendants(panel.root as unknown as FakeNode)
      .filter((node) => node.classList.contains("hud-power__chip"));
    expect(chips.map((chip) => chip.classList.contains("is-pulsed"))).toEqual([false, true]);
  });
});
