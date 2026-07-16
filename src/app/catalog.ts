export type Locale = "pt-BR" | "en";

export type ExperienceId = "continuous-room" | "bot-training" | "bot-vs-bot-lab";

export type CharacterId =
  | "03a976fb-7313-4064-a477-5bb9b0760034"
  | "6ee8baa5-3277-413b-ae0e-2659b9cc52e9"
  | "d083c3dc-7162-4391-8628-6adde0b8d8d6"
  | "5474c45c-2987-43e0-af2c-a6500c836881";

export type Experience = Readonly<{
  id: ExperienceId;
  name: string;
  description: string;
  actionLabel: string;
  journeyLabel: string;
}>;

export type Character = Readonly<{
  id: CharacterId;
  name: string;
  assetPath: string;
  accent: "blue" | "gold" | "green" | "red";
  label: string;
  description: string;
}>;

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
  labBoundary: string;
  labObservation: string;
  labConfiguration: string;
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

const CHARACTER_BASE = [
  {
    id: "03a976fb-7313-4064-a477-5bb9b0760034",
    name: "Ranni",
    assetPath: "/characters/ranni.png",
    accent: "blue",
  },
  {
    id: "6ee8baa5-3277-413b-ae0e-2659b9cc52e9",
    name: "Killer Bee",
    assetPath: "/characters/killer-bee.png",
    accent: "gold",
  },
  {
    id: "d083c3dc-7162-4391-8628-6adde0b8d8d6",
    name: "Crocodilo Arcano",
    assetPath: "/characters/crocodilo-arcano.png",
    accent: "green",
  },
  {
    id: "5474c45c-2987-43e0-af2c-a6500c836881",
    name: "Nico",
    assetPath: "/characters/nico.png",
    accent: "red",
  },
] as const;

const PT_CHARACTER_DESCRIPTIONS = [
  "Combatente 01 · personagem canônico",
  "Combatente 02 · personagem canônico",
  "Combatente 03 · personagem canônico",
  "Combatente 04 · personagem canônico",
] as const;

const EN_CHARACTER_DESCRIPTIONS = [
  "Fighter 01 · canonical character",
  "Fighter 02 · canonical character",
  "Fighter 03 · canonical character",
  "Fighter 04 · canonical character",
] as const;

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
  labIntroduction: "Um espaço separado para configurar competidores e acompanhar partidas sem controlar um personagem.",
  labBoundary: "Contas serão exigidas para salvar e administrar competidores.",
  labObservation: "Acompanhe disputas como espectador.",
  labConfiguration: "Prepare configurações antes da partida.",
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
  labIntroduction: "A separate space to configure competitors and watch matches without controlling a character.",
  labBoundary: "Accounts will be required to save and manage competitors.",
  labObservation: "Watch matches as a spectator.",
  labConfiguration: "Prepare configurations before a match.",
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
  copy: ProductCopy;
}> {
  const descriptions = locale === "pt-BR" ? PT_CHARACTER_DESCRIPTIONS : EN_CHARACTER_DESCRIPTIONS;
  const characters = Object.freeze(
    CHARACTER_BASE.map((character, index) =>
      Object.freeze({
        ...character,
        label: locale === "pt-BR" ? "Personagem " + String(index + 1) : "Character " + String(index + 1),
        description: descriptions[index] ?? "",
      }),
    ),
  );

  return Object.freeze({
    experiences: locale === "pt-BR" ? PT_EXPERIENCES : EN_EXPERIENCES,
    characters,
    copy: locale === "pt-BR" ? PT_COPY : EN_COPY,
  });
}

export function routeForExperience(experienceId: ExperienceId): string {
  if (experienceId === "continuous-room") return "/jogar/personagem";
  if (experienceId === "bot-training") return "/treino/personagem";
  return "/laboratorio";
}
