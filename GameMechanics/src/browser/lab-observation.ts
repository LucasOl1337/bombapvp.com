import type { GameSnapshot } from "../contracts.ts";
import type { BotProfileId } from "../bots/index.ts";
import type { BrowserBotDriver } from "./bot-drivers.ts";
import { botProfileForPlayer, type BrowserMatchConfiguration } from "./match-mode.ts";

export type BotLabObservation = Readonly<{
  competitors: readonly [
    Readonly<{
      championName: string;
      profileId: BotProfileId;
      profileLabel: string;
      wins: number;
      modelVersion: string;
      masteryBasisPoints: number;
      activeTechniqueIds: readonly string[];
      lastTechniqueId: string | null;
      experienceEvents: number;
      compatibilityWarnings: readonly string[];
    }>,
    Readonly<{
      championName: string;
      profileId: BotProfileId;
      profileLabel: string;
      wins: number;
      modelVersion: string;
      masteryBasisPoints: number;
      activeTechniqueIds: readonly string[];
      lastTechniqueId: string | null;
      experienceEvents: number;
      compatibilityWarnings: readonly string[];
    }>,
  ];
  roundNumber: number;
  phase: GameSnapshot["phase"];
  phaseLabel: string;
  matchNumber: number;
  result: string | null;
  summary: string;
}>;

const PHASE_LABELS = Object.freeze({
  "pt-BR": Object.freeze({
    "round-start": "Preparar",
    playing: "Em jogo",
    "sudden-death": "Morte súbita",
    paused: "Pausado",
    "round-over": "Fim da rodada",
    "match-over": "Fim da partida",
  }),
  en: Object.freeze({
    "round-start": "Get ready",
    playing: "Playing",
    "sudden-death": "Sudden death",
    paused: "Paused",
    "round-over": "Round over",
    "match-over": "Match over",
  }),
});

export function createBotLabObservation(
  configuration: BrowserMatchConfiguration,
  snapshot: GameSnapshot,
  championNames: readonly [string, string],
  locale: "pt-BR" | "en",
  matchNumber = 1,
  drivers: readonly BrowserBotDriver[] = Object.freeze([]),
): BotLabObservation | null {
  if (configuration.mode !== "bot-lab") return null;
  const profiles = [
    botProfileForPlayer(configuration, 0)!,
    botProfileForPlayer(configuration, 1)!,
  ] as const;
  const competitor = (index: 0 | 1) => {
    const seat = snapshot.config.seats[index]!;
    const profile = profiles[index]!;
    const driver = drivers.find(({ playerIndex }) => playerIndex === index);
    return Object.freeze({
      championName: championNames[index]!,
      profileId: profile.id,
      profileLabel: profile.label,
      wins: snapshot.scores.find(({ competitorId }) => competitorId === seat.competitorId)?.wins ?? 0,
      modelVersion: driver?.modelVersion ?? "unobserved",
      masteryBasisPoints: driver?.masteryBasisPoints ?? 0,
      activeTechniqueIds: Object.freeze(
        driver?.techniques.filter(({ status }) => status === "active").map(({ id }) => id) ?? [],
      ),
      lastTechniqueId: driver?.lastTechniqueId ?? null,
      experienceEvents: driver?.experienceEvents ?? 0,
      compatibilityWarnings: driver?.compatibilityWarnings ?? Object.freeze([]),
    });
  };
  const competitors: BotLabObservation["competitors"] = Object.freeze([
    competitor(0),
    competitor(1),
  ]);
  const phaseLabel = PHASE_LABELS[locale][snapshot.phase];
  const winnerIndex = snapshot.matchWinner === null
    ? -1
    : snapshot.config.seats.findIndex(({ competitorId }) => competitorId === snapshot.matchWinner);
  const winner = winnerIndex === 0 || winnerIndex === 1 ? competitors[winnerIndex] : null;
  const result = winner
    ? locale === "pt-BR"
      ? `${winner.profileLabel} · ${winner.championName} venceu a partida`
      : `${winner.profileLabel} · ${winner.championName} wins the match`
    : null;
  return Object.freeze({
    competitors,
    roundNumber: snapshot.roundNumber,
    phase: snapshot.phase,
    phaseLabel,
    matchNumber: Math.max(1, Math.trunc(matchNumber)),
    result,
    summary: `${profiles[0].label} vs ${profiles[1].label} · ${phaseLabel}`,
  });
}
