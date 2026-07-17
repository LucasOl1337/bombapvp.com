import {
  catalogFor,
  routeForExperience,
  type Character,
  type CharacterId,
  type Experience,
  type ExperienceId,
  type Locale,
  type ProductCopy,
} from "./catalog.ts";
import { createLabMatchParams } from "../lab/competitors.ts";
import {
  DEFAULT_CONTINUOUS_BOT_ID,
  DEFAULT_TRAINING_BOT_ID,
  type LocalBotId,
  type LocalBotMetadata,
} from "../original-game/Engine/bot-catalog.ts";

export type AppScreen = "launcher" | "character-selection" | "game-launch" | "laboratory";

export type AppSnapshot = Readonly<{
  brand: "Bomba PvP";
  locale: Locale;
  screen: AppScreen;
  currentPath: string;
  experiences: readonly Experience[];
  characters: readonly Character[];
  bots: readonly LocalBotMetadata[];
  copy: ProductCopy;
  activeExperience: Experience | null;
  selectedCharacter: Character | null;
  selectedBot: LocalBotId;
}>;

export type AppIntent =
  | Readonly<{ type: "open-experience"; experienceId: ExperienceId }>
  | Readonly<{ type: "select-character"; characterId: CharacterId }>
  | Readonly<{ type: "select-bot"; botId: LocalBotId }>
  | Readonly<{ type: "confirm-character" }>
  | Readonly<{ type: "start-lab-match"; models: readonly string[]; labels?: readonly string[] }>
  | Readonly<{ type: "back-to-selection" }>
  | Readonly<{ type: "back-to-launcher" }>
  | Readonly<{ type: "navigate"; path: string }>;

function freezeSnapshot(snapshot: AppSnapshot): AppSnapshot {
  return Object.freeze(snapshot);
}

function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0] ?? "/";
  if (!pathname || pathname === "/index.html") return "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function experienceForPath(path: string): ExperienceId | null {
  if (path.startsWith("/jogar/")) return "continuous-room";
  if (path.startsWith("/treino/")) return "bot-training";
  if (path === "/laboratorio") return "bot-vs-bot-lab";
  return null;
}

function defaultBotForExperience(experienceId: ExperienceId | null): LocalBotId {
  return experienceId === "continuous-room"
    ? DEFAULT_CONTINUOUS_BOT_ID
    : DEFAULT_TRAINING_BOT_ID;
}

export function snapshotForPath(locale: Locale, path: string): AppSnapshot {
  const catalog = catalogFor(locale);
  const normalizedPath = normalizePath(path);
  const experienceId = experienceForPath(normalizedPath);
  const activeExperience =
    catalog.experiences.find((experience) => experience.id === experienceId) ?? null;

  if (experienceId === "bot-vs-bot-lab") {
    return freezeSnapshot({
      brand: "Bomba PvP",
      locale,
      screen: "laboratory",
      currentPath: "/laboratorio",
      ...catalog,
      activeExperience,
      selectedCharacter: null,
      selectedBot: defaultBotForExperience(experienceId),
    });
  }

  if (experienceId === "continuous-room" || experienceId === "bot-training") {
    return freezeSnapshot({
      brand: "Bomba PvP",
      locale,
      screen: "character-selection",
      currentPath: routeForExperience(experienceId),
      ...catalog,
      activeExperience,
      selectedCharacter: null,
      selectedBot: defaultBotForExperience(experienceId),
    });
  }

  return freezeSnapshot({
    brand: "Bomba PvP",
    locale,
    screen: "launcher",
    currentPath: "/",
    ...catalog,
    activeExperience: null,
    selectedCharacter: null,
    selectedBot: defaultBotForExperience(null),
  });
}

export function reduceApp(snapshot: AppSnapshot, intent: AppIntent): AppSnapshot {
  if (intent.type === "navigate") {
    return snapshotForPath(snapshot.locale, intent.path);
  }

  if (intent.type === "back-to-launcher") {
    if (snapshot.screen === "launcher") return snapshot;
    return snapshotForPath(snapshot.locale, "/");
  }

  if (intent.type === "open-experience") {
    const path = routeForExperience(intent.experienceId);
    if (snapshot.currentPath === path) return snapshot;
    return snapshotForPath(snapshot.locale, path);
  }

  if (intent.type === "select-character") {
    if (snapshot.screen !== "character-selection") return snapshot;
    const selectedCharacter =
      snapshot.characters.find((character) => character.id === intent.characterId) ?? null;
    if (!selectedCharacter || selectedCharacter.id === snapshot.selectedCharacter?.id) return snapshot;
    return freezeSnapshot({ ...snapshot, selectedCharacter });
  }

  if (intent.type === "select-bot") {
    if (
      snapshot.screen !== "character-selection"
      || (snapshot.activeExperience?.id !== "bot-training"
        && snapshot.activeExperience?.id !== "continuous-room")
      || snapshot.selectedBot === intent.botId
    ) return snapshot;
    return freezeSnapshot({ ...snapshot, selectedBot: intent.botId });
  }

  if (intent.type === "confirm-character") {
    if (
      snapshot.screen !== "character-selection" ||
      !snapshot.selectedCharacter ||
      !snapshot.activeExperience
    ) {
      return snapshot;
    }
    const mode = snapshot.activeExperience.id === "continuous-room" ? "continuous" : "training";
    const currentPath = `/arena/?mode=${mode}&character=${encodeURIComponent(snapshot.selectedCharacter.id)}&bot=${encodeURIComponent(snapshot.selectedBot)}`;
    return freezeSnapshot({ ...snapshot, screen: "game-launch", currentPath });
  }

  if (intent.type === "start-lab-match") {
    if (snapshot.screen !== "laboratory") return snapshot;
    const query = createLabMatchParams(intent.models, intent.labels);
    if (!query) return snapshot;
    return freezeSnapshot({
      ...snapshot,
      screen: "game-launch",
      currentPath: `/arena/?${query.toString()}`,
    });
  }

  if (intent.type === "back-to-selection") {
    if (snapshot.screen !== "game-launch" || !snapshot.activeExperience) return snapshot;
    return freezeSnapshot({
      ...snapshot,
      screen: "character-selection",
      currentPath: routeForExperience(snapshot.activeExperience.id),
    });
  }

  return snapshot;
}
