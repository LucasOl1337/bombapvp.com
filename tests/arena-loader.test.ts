import { describe, expect, it, vi } from "vitest";
import { createDefaultArenaDefinition, normalizeArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { fetchActiveArenaDefinition } from "../src/original-game/Arenas/arena-loader.ts";

function createFetch(response: { ok: boolean; json: () => Promise<unknown> }): typeof fetch {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

describe("active arena loader", () => {
  it("returns the default arena when no fetch function is available", async () => {
    await expect(fetchActiveArenaDefinition(undefined)).resolves.toEqual(createDefaultArenaDefinition());
  });

  it("requests the active arena with no-store and same-origin options", async () => {
    const arena = createDefaultArenaDefinition();
    const fetchArena = createFetch({
      ok: true,
      json: async () => ({ arena }),
    });

    await fetchActiveArenaDefinition(fetchArena);

    expect(fetchArena).toHaveBeenCalledWith("/api/arena/active", {
      cache: "no-store",
      credentials: "same-origin",
    });
  });

  it("returns the default arena when the response is not ok", async () => {
    const fetchArena = createFetch({
      ok: false,
      json: async () => ({ arena: createDefaultArenaDefinition() }),
    });

    await expect(fetchActiveArenaDefinition(fetchArena)).resolves.toEqual(createDefaultArenaDefinition());
  });

  it("returns the default arena when the response payload is missing an arena", async () => {
    const fetchArena = createFetch({
      ok: true,
      json: async () => ({}),
    });

    await expect(fetchActiveArenaDefinition(fetchArena)).resolves.toEqual(createDefaultArenaDefinition());
  });

  it("returns the default arena when the response arena is invalid", async () => {
    const invalidArena = {
      ...createDefaultArenaDefinition(),
      grid: { width: 8, height: 11 },
    };
    const fetchArena = createFetch({
      ok: true,
      json: async () => ({ arena: invalidArena }),
    });

    await expect(fetchActiveArenaDefinition(fetchArena)).resolves.toEqual(createDefaultArenaDefinition());
  });

  it("returns a normalized arena when the response arena is valid", async () => {
    const arena = {
      ...createDefaultArenaDefinition(),
      id: "remote-arena",
      name: "  Remote Arena  ",
      themeId: "CLASSIC-STONE",
    };
    const fetchArena = createFetch({
      ok: true,
      json: async () => ({ arena }),
    });

    await expect(fetchActiveArenaDefinition(fetchArena)).resolves.toEqual(normalizeArenaDefinition(arena));
  });

  it("returns the default arena when fetch rejects", async () => {
    const fetchArena = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await expect(fetchActiveArenaDefinition(fetchArena)).resolves.toEqual(createDefaultArenaDefinition());
  });

  it("returns the default arena when response json rejects", async () => {
    const fetchArena = createFetch({
      ok: true,
      json: async () => {
        throw new Error("bad json");
      },
    });

    await expect(fetchActiveArenaDefinition(fetchArena)).resolves.toEqual(createDefaultArenaDefinition());
  });
});
