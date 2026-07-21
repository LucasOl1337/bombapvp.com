import type {
  BotDecisionExperienceEvent,
  BotExperienceEvent,
  BotMatchExperienceEvent,
  ExperienceSink,
} from "./contracts.ts";

export type InMemoryExperienceSink = ExperienceSink & Readonly<{
  events(): readonly BotExperienceEvent[];
}>;

export function createInMemoryExperienceSink(): InMemoryExperienceSink {
  const recorded: BotExperienceEvent[] = [];
  return Object.freeze({
    append(event: BotExperienceEvent): void {
      recorded.push(event);
    },
    events(): readonly BotExperienceEvent[] {
      return Object.freeze([...recorded]);
    },
  });
}

export const NULL_EXPERIENCE_SINK: ExperienceSink = Object.freeze({
  append(_event: BotExperienceEvent): void {
    // Explicit no-op sink keeps recording a caller-owned policy decision.
  },
});

export function appendDecisionExperience(
  sink: ExperienceSink,
  event: BotDecisionExperienceEvent,
): void {
  sink.append(event);
}

export function appendMatchExperience(
  sink: ExperienceSink,
  event: BotMatchExperienceEvent,
): void {
  sink.append(event);
}
