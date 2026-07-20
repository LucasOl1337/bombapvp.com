import type { ArenaDefinition } from "../Gameplay/types";
import {
  createDefaultArenaDefinition,
  normalizeArenaDefinition,
  validateArenaDefinition,
} from "./arena";

export interface ActiveArenaResponse {
  arena: ArenaDefinition;
}

export async function fetchActiveArenaDefinition(
  fetchArena: typeof fetch | undefined = typeof fetch === "undefined" ? undefined : fetch,
): Promise<ArenaDefinition> {
  if (!fetchArena) {
    return createDefaultArenaDefinition();
  }
  try {
    const response = await fetchArena("/api/arena/active", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return createDefaultArenaDefinition();
    }
    const payload = await response.json() as ActiveArenaResponse;
    if (!payload?.arena) {
      return createDefaultArenaDefinition();
    }
    const validation = validateArenaDefinition(payload.arena);
    if (!validation.ok) {
      return createDefaultArenaDefinition();
    }
    return normalizeArenaDefinition(payload.arena);
  } catch {
    return createDefaultArenaDefinition();
  }
}
