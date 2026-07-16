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

export type AppScreen = "launcher" | "character-selection" | "launch-ready" | "laboratory";

export type AppSnapshot = Readonly<{
  brand: "Bomba PvP";
  locale: Locale;
  screen: AppScreen;
  currentPath: string;
  experiences: readonly Experience[];
  characters: readonly Character[];
  copy: ProductCopy;
  activeExperience: Experience | null;
  selectedCharacter: Character | null;
}>;

export type AppIntent =
  | Readonly<{ type: "open-experience"; experienceId: ExperienceId }>
  | Readonly<{ type: "select-character"; characterId: CharacterId }>
  | Readonly<{ type: "confirm-character" }>
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

  if (intent.type === "confirm-character") {
    if (
      snapshot.screen !== "character-selection" ||
      !snapshot.selectedCharacter ||
      !snapshot.activeExperience
    ) {
      return snapshot;
    }
    const currentPath =
      snapshot.activeExperience.id === "continuous-room" ? "/jogar/pronto" : "/treino/pronto";
    return freezeSnapshot({ ...snapshot, screen: "launch-ready", currentPath });
  }

  if (intent.type === "back-to-selection") {
    if (snapshot.screen !== "launch-ready" || !snapshot.activeExperience) return snapshot;
    return freezeSnapshot({
      ...snapshot,
      screen: "character-selection",
      currentPath: routeForExperience(snapshot.activeExperience.id),
    });
  }

  return snapshot;
}
