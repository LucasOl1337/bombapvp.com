import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadGrokCharacterManifest,
  resolveNixEmberPackageRoot,
  validateGrokCharacterPackage,
} from "../src/shared/grok-character-package";

describe("Grok character experiment package (Nix Ember lab-pack)", () => {
  const packageRoot = resolveNixEmberPackageRoot();
  const expectedRoot = join(
    process.cwd(),
    "Champions",
    "nix-ember",
    "experiments",
    "lab-pack",
  );

  it("resolves the lab-pack under Champions/nix-ember/experiments", () => {
    expect(packageRoot).toBe(expectedRoot);
    expect(existsSync(packageRoot)).toBe(true);
    expect(existsSync(join(process.cwd(), "Champions", "nix-ember", "assets", "portrait.png"))).toBe(
      true,
    );
  });

  it("loads the real on-disk manifest and reports a valid bomb-game pack", () => {
    const report = validateGrokCharacterPackage(packageRoot);

    expect(report.missing, `missing: ${report.missing.join(", ")}`).toEqual([]);
    expect(report.errors, `errors: ${report.errors.join(", ")}`).toEqual([]);
    expect(report.ok).toBe(true);

    const manifest = loadGrokCharacterManifest(packageRoot);
    expect(report.displayName).toBe(manifest.displayName);
    expect(report.ultimateName).toBe(manifest.ultimate.name);
    expect(manifest.displayName).toBe("Nix Ember");
    expect(manifest.ultimate.name).toBe("Ember Vault");
    expect(manifest.clips["plant-south"].bakesBomb).toBe(false);
    expect(report.clipFrameCounts["idle-south"]).toBe(4);
    expect(report.clipFrameCounts["walk-south"]).toBe(8);
    expect(report.clipFrameCounts["cast-south"]).toBe(4);
    expect(report.clipFrameCounts["plant-south"]).toBe(6);
  });

  it("rejects a missing package root via the same validator entry point", () => {
    const report = validateGrokCharacterPackage(`${packageRoot}__does-not-exist`);
    expect(report.ok).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
  });
});
