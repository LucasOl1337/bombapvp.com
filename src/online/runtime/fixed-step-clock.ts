export interface FixedStepClockOptions {
  tickRate?: number;
  maxCatchUpTicks?: number;
  maxBacklogTicks?: number;
}

export interface FixedStepAdvanceResult {
  ticksAdvanced: number;
  serverTick: number;
  backlogMs: number;
  overloaded: boolean;
}

/**
 * Converts scheduler elapsed time into exact simulation steps. A delayed host
 * therefore advances every due tick instead of slowing the match by advancing
 * one nominal interval. Work per call is bounded and overload remains visible.
 */
export class FixedStepClock {
  public readonly tickRate: number;
  public readonly stepMs: number;
  public readonly maxCatchUpTicks: number;
  public readonly maxBacklogTicks: number;

  private accumulatorMs = 0;
  private currentTick = 0;

  constructor(options: FixedStepClockOptions = {}) {
    this.tickRate = options.tickRate ?? 60;
    this.maxCatchUpTicks = options.maxCatchUpTicks ?? 8;
    this.maxBacklogTicks = options.maxBacklogTicks ?? 30;
    assertPositiveInteger(this.tickRate, "tickRate");
    assertPositiveInteger(this.maxCatchUpTicks, "maxCatchUpTicks");
    assertPositiveInteger(this.maxBacklogTicks, "maxBacklogTicks");
    if (this.maxBacklogTicks < this.maxCatchUpTicks) {
      throw new RangeError("maxBacklogTicks must be greater than or equal to maxCatchUpTicks");
    }
    this.stepMs = 1_000 / this.tickRate;
  }

  get serverTick(): number {
    return this.currentTick;
  }

  get backlogMs(): number {
    return this.accumulatorMs;
  }

  advance(elapsedMs: number, step: (fixedDeltaMs: number, serverTick: number) => void): FixedStepAdvanceResult {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      throw new RangeError("elapsedMs must be a finite non-negative number");
    }

    this.accumulatorMs += elapsedMs;
    const dueTicks = Math.floor((this.accumulatorMs + Number.EPSILON) / this.stepMs);
    const ticksAdvanced = Math.min(dueTicks, this.maxCatchUpTicks);
    for (let index = 0; index < ticksAdvanced; index += 1) {
      this.currentTick += 1;
      step(this.stepMs, this.currentTick);
      this.accumulatorMs -= this.stepMs;
    }
    if (Math.abs(this.accumulatorMs) < 1e-9) this.accumulatorMs = 0;

    return {
      ticksAdvanced,
      serverTick: this.currentTick,
      backlogMs: this.accumulatorMs,
      overloaded: this.accumulatorMs >= this.stepMs * this.maxBacklogTicks,
    };
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive integer`);
  }
}
