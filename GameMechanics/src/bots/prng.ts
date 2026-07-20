import { hashUint32 } from "../kernel/world-state.ts";

/**
 * Deterministic, seedable PRNG for bot decision jitter.
 *
 * The kernel owns all *simulation* randomness; this generator lives strictly
 * on the adapter side and never touches WorldState. Bots use it only to break
 * ties between equally-good moves so behaviour stays deterministic per seed
 * without becoming robotically predictable.
 *
 * mulberry32 — a small, well-distributed 32-bit generator. Given the same
 * seed string the sequence is byte-for-byte reproducible across runs and
 * platforms (integer math only), which keeps replays and tests stable.
 */
export interface BotPrng {
  /** Next float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, bound). bound must be a positive integer. */
  int(bound: number): number;
  /** Uniform pick from a non-empty readonly array. */
  pick<T>(items: readonly T[]): T;
}

/** Build a PRNG from a 32-bit integer state. */
function fromState(initial: number): BotPrng {
  let state = initial >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  function int(bound: number): number {
    if (!Number.isInteger(bound) || bound <= 0) {
      throw new Error(`BotPrng.int bound must be a positive integer; got ${String(bound)}.`);
    }
    return Math.floor(next() * bound);
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("BotPrng.pick requires a non-empty array.");
    }
    return items[int(items.length)]!;
  }

  return Object.freeze({ next, int, pick });
}

/**
 * Create a deterministic PRNG from a seed string. Distinct seeds yield distinct
 * streams; the same seed always reproduces the same stream. Uses the shared
 * {@link hashUint32} so seeding matches the rest of the codebase's hashing.
 */
export function createBotPrng(seed: string): BotPrng {
  // Fold in a fixed salt so a bot seed never collides with a same-named
  // kernel seed stream by construction.
  return fromState(hashUint32(`bot|${seed}`));
}
