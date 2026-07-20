import { describe, expect, it } from "vitest";
import { FixedStepClock } from "../src/online/runtime/fixed-step-clock.ts";

describe("authoritative fixed-step clock", () => {
  it("advances all simulation ticks due after a delayed 50ms scheduler callback", () => {
    const clock = new FixedStepClock({ tickRate: 60 });
    const steps: Array<{ deltaMs: number; tick: number }> = [];

    const result = clock.advance(50, (deltaMs, tick) => steps.push({ deltaMs, tick }));

    expect(result.ticksAdvanced).toBe(3);
    expect(result.serverTick).toBe(3);
    expect(result.backlogMs).toBeCloseTo(0, 8);
    expect(steps).toHaveLength(3);
    expect(steps.map(({ tick }) => tick)).toEqual([1, 2, 3]);
    expect(steps.every(({ deltaMs }) => Math.abs(deltaMs - 1_000 / 60) < 1e-8)).toBe(true);
  });

  it("bounds catch-up work without hiding an unhealthy backlog", () => {
    const clock = new FixedStepClock({ tickRate: 60, maxCatchUpTicks: 4, maxBacklogTicks: 8 });
    let calls = 0;

    const result = clock.advance(1_000, () => { calls += 1; });

    expect(calls).toBe(4);
    expect(result.ticksAdvanced).toBe(4);
    expect(result.backlogMs).toBeGreaterThan(900);
    expect(result.overloaded).toBe(true);
  });

  it("accumulates sub-tick elapsed time deterministically", () => {
    const clock = new FixedStepClock({ tickRate: 60 });
    let calls = 0;

    expect(clock.advance(8, () => { calls += 1; }).ticksAdvanced).toBe(0);
    expect(clock.advance(8, () => { calls += 1; }).ticksAdvanced).toBe(0);
    expect(clock.advance(1, () => { calls += 1; }).ticksAdvanced).toBe(1);
    expect(calls).toBe(1);
    expect(clock.serverTick).toBe(1);
  });

  it("rejects invalid scheduler time and impossible limits", () => {
    const clock = new FixedStepClock();
    expect(() => clock.advance(-1, () => undefined)).toThrow(RangeError);
    expect(() => clock.advance(Number.POSITIVE_INFINITY, () => undefined)).toThrow(RangeError);
    expect(() => new FixedStepClock({ maxCatchUpTicks: 8, maxBacklogTicks: 4 })).toThrow(RangeError);
  });
});
