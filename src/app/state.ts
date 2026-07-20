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
import {
  type LocalBotId,
  type LocalBotMetadata,
} from "../original-game/Engine/bot-catalog.ts";
import {
  OFFLINE_LAUNCH_DEFAULTS,
  resolveLaunchRequest,
} from "../matches/launch-request.ts";
import { launchRequestToSearchParams } from "../matches/url-search-params.ts";

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
  | Readonly<{ type: "start-online-pvp"; characterId?: CharacterId }>
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
  if (path === "/GameMechanics" || path.startsWith("/GameMechanics/")) {
    return "game-mechanics-prototype";
  }
  return null;
}

function defaultBotForExperience(experienceId: ExperienceId | null): LocalBotId {
  return experienceId === "continuous-room"
    ? OFFLINE_LAUNCH_DEFAULTS.continuous
    : OFFLINE_LAUNCH_DEFAULTS.training;
}

function resolveCharacter(
  characters: readonly Character[],
  characterId: CharacterId | string | null | undefined,
): Character | null {
  if (!characterId) return null;
  return characters.find((character) => character.id === characterId) ?? null;
}

function launchContinuousSnapshot(
  locale: Locale,
  catalog: ReturnType<typeof catalogFor>,
  character: Character | null,
): AppSnapshot {
  const activeExperience =
    catalog.experiences.find((experience) => experience.id === "continuous-room") ?? null;
  const selectedCharacter = character ?? catalog.characters[0] ?? null;
  const request = resolveLaunchRequest({
    mode: "online",
    character: selectedCharacter?.id ?? null,
  });
  if (!request.ok) {
    return freezeSnapshot({
      brand: "Bomba PvP",
      locale,
      screen: "launcher",
      currentPath: "/",
      ...catalog,
      activeExperience: null,
      selectedCharacter,
      selectedBot: defaultBotForExperience("continuous-room"),
    });
  }
  return freezeSnapshot({
    brand: "Bomba PvP",
    locale,
    screen: "game-launch",
    currentPath: `/arena/?${launchRequestToSearchParams(request.request).toString()}`,
    ...catalog,
    activeExperience,
    selectedCharacter,
    selectedBot: defaultBotForExperience("continuous-room"),
  });
}

export function snapshotForPath(locale: Locale, path: string): AppSnapshot {
  const catalog = catalogFor(locale);
  const normalizedPath = normalizePath(path);
  const experienceId = experienceForPath(normalizedPath);
  const activeExperience =
    catalog.experiences.find((experience) => experience.id === experienceId) ?? null;

  if (experienceId === "game-mechanics-prototype") {
    return freezeSnapshot({
      brand: "Bomba PvP",
      locale,
      screen: "game-launch",
      currentPath: "/GameMechanics/",
      ...catalog,
      activeExperience,
      selectedCharacter: null,
      selectedBot: defaultBotForExperience(null),
    });
  }

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

  // Online PvP skips the secondary selection screen and enters real matchmaking.
  if (experienceId === "continuous-room") {
    return launchContinuousSnapshot(locale, catalog, catalog.characters[0] ?? null);
  }

  if (experienceId === "bot-training") {
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
    selectedCharacter: catalog.characters[0] ?? null,
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
    // Online PvP enters matchmaking with the character focused on the launcher.
    if (intent.experienceId === "continuous-room") {
      return launchContinuousSnapshot(
        snapshot.locale,
        {
          experiences: snapshot.experiences,
          characters: snapshot.characters,
          bots: snapshot.bots,
          copy: snapshot.copy,
        },
        snapshot.selectedCharacter ?? snapshot.characters[0] ?? null,
      );
    }
    const path = routeForExperience(intent.experienceId);
    if (snapshot.currentPath === path) return snapshot;
    return snapshotForPath(snapshot.locale, path);
  }

  if (intent.type === "start-online-pvp") {
    const selectedCharacter = resolveCharacter(snapshot.characters, intent.characterId)
      ?? snapshot.selectedCharacter
      ?? snapshot.characters[0]
      ?? null;
    return launchContinuousSnapshot(
      snapshot.locale,
      {
        experiences: snapshot.experiences,
        characters: snapshot.characters,
        bots: snapshot.bots,
        copy: snapshot.copy,
      },
      selectedCharacter,
    );
  }

  if (intent.type === "select-character") {
    if (snapshot.screen !== "character-selection" && snapshot.screen !== "launcher") return snapshot;
    const selectedCharacter =
      snapshot.characters.find((character) => character.id === intent.characterId) ?? null;
    if (!selectedCharacter || selectedCharacter.id === snapshot.selectedCharacter?.id) return snapshot;
    return freezeSnapshot({ ...snapshot, selectedCharacter });
  }

  if (intent.type === "select-bot") {
    if (
      snapshot.screen !== "character-selection"
      || snapshot.activeExperience?.id !== "bot-training"
      || snapshot.selectedBot === intent.botId
    ) return snapshot;
    return freezeSnapshot({ ...snapshot, selectedBot: intent.botId });
  }

  if (intent.type === "confirm-character") {
    if (
      snapshot.screen !== "character-selection" ||
      !snapshot.selectedCharacter ||
      !snapshot.activeExperience ||
      snapshot.activeExperience.id !== "bot-training"
    ) {
      return snapshot;
    }
    const request = resolveLaunchRequest({
      mode: "training",
      character: snapshot.selectedCharacter.id,
      bot: snapshot.selectedBot,
    });
    if (!request.ok) return snapshot;
    const currentPath = `/arena/?${launchRequestToSearchParams(request.request).toString()}`;
    return freezeSnapshot({ ...snapshot, screen: "game-launch", currentPath });
  }

  if (intent.type === "start-lab-match") {
    if (snapshot.screen !== "laboratory") return snapshot;
    const request = resolveLaunchRequest(
      intent.labels === undefined
        ? { mode: "lab", models: intent.models }
        : { mode: "lab", models: intent.models, labels: intent.labels },
    );
    if (!request.ok) return snapshot;
    return freezeSnapshot({
      ...snapshot,
      screen: "game-launch",
      currentPath: `/arena/?${launchRequestToSearchParams(request.request).toString()}`,
    });
  }

  if (intent.type === "back-to-selection") {
    if (snapshot.screen !== "game-launch" || !snapshot.activeExperience) return snapshot;
    const experienceId = snapshot.activeExperience.id;
    // Lab never uses character-selection; "revise" must return to the laboratory form.
    if (experienceId === "bot-vs-bot-lab") {
      return freezeSnapshot({
        ...snapshot,
        screen: "laboratory",
        currentPath: routeForExperience(experienceId),
      });
    }
    // Online PvP has no secondary selection screen — revise returns to the launcher roster.
    if (experienceId === "continuous-room" || experienceId === "game-mechanics-prototype") {
      return snapshotForPath(snapshot.locale, "/");
    }
    return freezeSnapshot({
      ...snapshot,
      screen: "character-selection",
      currentPath: routeForExperience(experienceId),
    });
  }

  return snapshot;
}
