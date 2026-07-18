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

export type ProductCopy = Readonly<{
  launcherTitle: string;
  launcherIntroduction: string;
  launcherKicker: string;
  experiencesLabel: string;
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
    name: "Sala contínua",
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
    name: "Continuous room",
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

const PT_COPY: ProductCopy = Object.freeze({
  launcherTitle: "Escolha sua experiência",
  launcherIntroduction: "Três formas claras de entrar no mesmo universo competitivo.",
  launcherKicker: "ESCOLHA SEU CAMINHO",
  experiencesLabel: "Experiências",
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
  readyKicker: "ESCOLHA CONFIRMADA",
  readyTitle: "Pronto para entrar",
  readyMessage: "Seu personagem e destino estão definidos. A entrada na arena será liberada quando esta experiência estiver pronta.",
  labKicker: "OBSERVAÇÃO COMPETITIVA",
  labTitle: "Laboratório Bot vs Bot",
  labIntroduction: "Compare de dois a quatro competidores, combinando Bomb, Pingo e os bots V1, V2 e V3 com modelos do 9Router.",
  footerLabel: "UM PRODUTO · TRÊS EXPERIÊNCIAS",
  languageLabel: "English",
});

const EN_COPY: ProductCopy = Object.freeze({
  launcherTitle: "Choose your experience",
  launcherIntroduction: "Three clear ways into the same competitive universe.",
  launcherKicker: "CHOOSE YOUR PATH",
  experiencesLabel: "Experiences",
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
  readyKicker: "CHOICE CONFIRMED",
  readyTitle: "Ready to enter",
  readyMessage: "Your character and destination are set. Arena entry will open when this experience is ready.",
  labKicker: "COMPETITIVE OBSERVATION",
  labTitle: "Bot vs Bot Lab",
  labIntroduction: "Compare two to four competitors by combining Bomb, Pingo, V1, V2, and V3 with 9Router models.",
  footerLabel: "ONE PRODUCT · THREE EXPERIENCES",
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
