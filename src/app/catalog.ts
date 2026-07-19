import {
  LOCAL_BOT_CATALOG,
  type LocalBotMetadata,
} from "../original-game/Engine/bot-catalog.ts";
import {
  listCharacterPresentations,
  type CharacterId as CatalogCharacterId,
  type CharacterLocale,
  type CharacterPresentation,
} from "../../Champions/index.ts";

export type Locale = CharacterLocale;

export type ExperienceId = "continuous-room" | "bot-training" | "bot-vs-bot-lab";

export type CharacterId = CatalogCharacterId;

export type Experience = Readonly<{
  id: ExperienceId;
  name: string;
  description: string;
  actionLabel: string;
  journeyLabel: string;
}>;

export type Character = CharacterPresentation;

export type ControlsGuideBinding = Readonly<{
  keys: readonly string[];
  action: string;
}>;

export type ControlsGuideCopy = Readonly<{
  label: string;
  title: string;
  tip: string;
  bindings: readonly ControlsGuideBinding[];
}>;

export type ProductCopy = Readonly<{
  launcherTitle: string;
  launcherIntroduction: string;
  launcherKicker: string;
  experiencesLabel: string;
  controlsGuide: ControlsGuideCopy;
  selectionKicker: string;
  selectionTitle: string;
  selectionIntroduction: string;
  charactersLabel: string;
  chooseLabel: string;
  selectedLabel: string;
  noSelectionLabel: string;
  continueLabel: string;
  backLabel: string;
  backToLauncherLabel: string;
  reviseLabel: string;
  reviseLabLabel: string;
  readyKicker: string;
  readyTitle: string;
  readyMessage: string;
  labKicker: string;
  labTitle: string;
  labIntroduction: string;
  footerLabel: string;
  languageLabel: string;
}>;

const PT_EXPERIENCES: readonly Experience[] = Object.freeze([
  Object.freeze({
    id: "continuous-room",
    name: "Jogo online PvP",
    description: "Entre em uma sequência de rodadas com outros jogadores e Completers.",
    actionLabel: "Jogar agora",
    journeyLabel: "Entrada imediata",
  }),
  Object.freeze({
    id: "bot-training",
    name: "Treino contra bots",
    description: "Pratique no seu ritmo contra adversários controlados pelo jogo.",
    actionLabel: "Preparar treino",
    journeyLabel: "Experiência individual",
  }),
  Object.freeze({
    id: "bot-vs-bot-lab",
    name: "Laboratório Bot vs Bot",
    description: "Configure e observe competidores mantidos pelo Bomba PvP.",
    actionLabel: "Conhecer o laboratório",
    journeyLabel: "Experiência de observação",
  }),
]);

const EN_EXPERIENCES: readonly Experience[] = Object.freeze([
  Object.freeze({
    id: "continuous-room",
    name: "Online PvP",
    description: "Join a sequence of rounds with other players and Completers.",
    actionLabel: "Play now",
    journeyLabel: "Instant entry",
  }),
  Object.freeze({
    id: "bot-training",
    name: "Bot training",
    description: "Practice at your own pace against game-controlled opponents.",
    actionLabel: "Prepare training",
    journeyLabel: "Solo experience",
  }),
  Object.freeze({
    id: "bot-vs-bot-lab",
    name: "Bot vs Bot Lab",
    description: "Configure and watch competitors maintained by Bomba PvP.",
    actionLabel: "Explore the lab",
    journeyLabel: "Spectator experience",
  }),
]);

const PT_CONTROLS_GUIDE: ControlsGuideCopy = Object.freeze({
  label: "Como jogar",
  title: "Comandos da arena",
  tip: "Os mesmos atalhos valem no jogo online e no treino. A habilidade especial depende do personagem escolhido.",
  bindings: Object.freeze([
    Object.freeze({ keys: Object.freeze(["W", "A", "S", "D", "↑", "↓", "←", "→"]), action: "Mover" }),
    Object.freeze({ keys: Object.freeze(["Q"]), action: "Soltar bomba" }),
    Object.freeze({ keys: Object.freeze(["R"]), action: "Detonar bomba remota" }),
    Object.freeze({ keys: Object.freeze(["Espaço"]), action: "Habilidade especial" }),
    Object.freeze({ keys: Object.freeze(["E"]), action: "Pronto no lobby" }),
  ]),
});

const EN_CONTROLS_GUIDE: ControlsGuideCopy = Object.freeze({
  label: "How to play",
  title: "Arena controls",
  tip: "The same controls apply online and in training. The special ability depends on your chosen fighter.",
  bindings: Object.freeze([
    Object.freeze({ keys: Object.freeze(["W", "A", "S", "D", "↑", "↓", "←", "→"]), action: "Move" }),
    Object.freeze({ keys: Object.freeze(["Q"]), action: "Drop bomb" }),
    Object.freeze({ keys: Object.freeze(["R"]), action: "Detonate remote bomb" }),
    Object.freeze({ keys: Object.freeze(["Space"]), action: "Special ability" }),
    Object.freeze({ keys: Object.freeze(["E"]), action: "Ready in lobby" }),
  ]),
});

const PT_COPY: ProductCopy = Object.freeze({
  launcherTitle: "Bomba PvP",
  launcherIntroduction: "Arena de bombardeiros no navegador. Conheça o elenco e entre na partida.",
  launcherKicker: "BROWSER BATTLE ARENA",
  experiencesLabel: "Modos de jogo",
  controlsGuide: PT_CONTROLS_GUIDE,
  selectionKicker: "PREPARE SUA ENTRADA",
  selectionTitle: "Escolha seu personagem",
  selectionIntroduction: "Esta escolha acompanha você até a próxima etapa da experiência.",
  charactersLabel: "Personagens",
  chooseLabel: "Escolher",
  selectedLabel: "Selecionado",
  noSelectionLabel: "Nenhum personagem selecionado",
  continueLabel: "Confirmar personagem",
  backLabel: "Voltar",
  backToLauncherLabel: "Voltar ao início",
  reviseLabel: "Revisar personagem",
  reviseLabLabel: "Revisar configuração",
  readyKicker: "ESCOLHA CONFIRMADA",
  readyTitle: "Pronto para entrar",
  readyMessage: "Seu personagem e destino estão definidos. A entrada na arena será liberada quando esta experiência estiver pronta.",
  labKicker: "OBSERVAÇÃO COMPETITIVA",
  labTitle: "Laboratório Bot vs Bot",
  labIntroduction: "Compare de dois a quatro competidores, combinando Bomb, Pingo e os bots V1, V2 e V3 com modelos do 9Router.",
  footerLabel: "BOMBA PVP · ARENA NO NAVEGADOR",
  languageLabel: "English",
});

const EN_COPY: ProductCopy = Object.freeze({
  launcherTitle: "Bomba PvP",
  launcherIntroduction: "Browser bomber arena. Meet the roster and jump into a match.",
  launcherKicker: "BROWSER BATTLE ARENA",
  experiencesLabel: "Game modes",
  controlsGuide: EN_CONTROLS_GUIDE,
  selectionKicker: "PREPARE YOUR ENTRY",
  selectionTitle: "Choose your character",
  selectionIntroduction: "This choice follows you into the next step of the experience.",
  charactersLabel: "Characters",
  chooseLabel: "Choose",
  selectedLabel: "Selected",
  noSelectionLabel: "No character selected",
  continueLabel: "Confirm character",
  backLabel: "Back",
  backToLauncherLabel: "Back to start",
  reviseLabel: "Review character",
  reviseLabLabel: "Review setup",
  readyKicker: "CHOICE CONFIRMED",
  readyTitle: "Ready to enter",
  readyMessage: "Your character and destination are set. Arena entry will open when this experience is ready.",
  labKicker: "COMPETITIVE OBSERVATION",
  labTitle: "Bot vs Bot Lab",
  labIntroduction: "Compare two to four competitors by combining Bomb, Pingo, V1, V2, and V3 with 9Router models.",
  footerLabel: "BOMBA PVP · BROWSER ARENA",
  languageLabel: "Português",
});

export function localeForHostname(hostname: string): Locale {
  const normalized = hostname.trim().toLowerCase().replace(/^www\./, "");
  return normalized === "bombpvp.com" ? "en" : "pt-BR";
}

export function catalogFor(locale: Locale): Readonly<{
  experiences: readonly Experience[];
  characters: readonly Character[];
  bots: readonly LocalBotMetadata[];
  copy: ProductCopy;
}> {
  return Object.freeze({
    experiences: locale === "pt-BR" ? PT_EXPERIENCES : EN_EXPERIENCES,
    characters: listCharacterPresentations(locale),
    bots: LOCAL_BOT_CATALOG,
    copy: locale === "pt-BR" ? PT_COPY : EN_COPY,
  });
}

export function routeForExperience(experienceId: ExperienceId): string {
  if (experienceId === "continuous-room") return "/jogar/personagem";
  if (experienceId === "bot-training") return "/treino/personagem";
  return "/laboratorio";
}
