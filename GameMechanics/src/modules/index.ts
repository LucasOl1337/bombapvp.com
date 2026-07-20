import type { ModuleSpec } from "../kernel/protocol.ts";
import { arenaModule } from "./arena/index.ts";
import { competitorsModule } from "./competitors/index.ts";
import { intentModule } from "./intent/index.ts";
import { locomotionModule } from "./locomotion/index.ts";
import { matchModule } from "./match/index.ts";
import { ordnanceModule } from "./ordnance/index.ts";
import { powerupsModule } from "./powerups/index.ts";
import { pressureModule } from "./pressure/index.ts";
import { skillsModule } from "./skills/index.ts";

/**
 * Default vertical modules for Slice 4A (powerups + competitive cycle + pressure).
 * Order of this array never decides schedule order (compile sorts by phase/module/system).
 */
export function createDefaultModules(
  order: "forward" | "reversed" = "forward",
): ModuleSpec[] {
  const modules: ModuleSpec[] = [
    intentModule,
    locomotionModule,
    ordnanceModule,
    arenaModule,
    competitorsModule,
    matchModule,
    pressureModule,
    powerupsModule,
    skillsModule,
  ];
  return order === "reversed" ? [...modules].reverse() : modules;
}

export {
  arenaModule,
  competitorsModule,
  intentModule,
  locomotionModule,
  matchModule,
  ordnanceModule,
  powerupsModule,
  pressureModule,
  skillsModule,
};
