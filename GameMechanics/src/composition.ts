/**
 * Composition root — the only place that imports concrete vertical modules
 * and builds the default MechanicsProgram.
 */
import { createMechanicsProgram, type MechanicsProgram } from "./kernel/program.ts";
import type { ModuleSpec } from "./kernel/protocol.ts";
import { createDefaultModules } from "./modules/index.ts";

export function createDefaultMechanicsProgram(
  order: "forward" | "reversed" = "forward",
): MechanicsProgram {
  return createMechanicsProgram(createDefaultModules(order));
}

export function createMechanicsProgramFromModules(
  modules: readonly ModuleSpec[],
): MechanicsProgram {
  return createMechanicsProgram(modules);
}

let defaultProgram: MechanicsProgram | null = null;

export function getDefaultMechanicsProgram(): MechanicsProgram {
  if (!defaultProgram) {
    defaultProgram = createDefaultMechanicsProgram();
  }
  return defaultProgram;
}

export { createDefaultModules, createMechanicsProgram };
