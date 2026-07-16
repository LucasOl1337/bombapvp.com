import type { LabTelemetryPlayerReport, LabTelemetryReport } from "./telemetry";

function formatMetric(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  const digits = Math.abs(value) < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(digits)}${suffix}`;
}

function metricLine(document: Document, entries: readonly [string, string, string][]): HTMLElement {
  const line = document.createElement("p");
  line.className = "lab-telemetry-card__metrics";
  for (const [label, value, title] of entries) {
    const metric = document.createElement("span");
    metric.title = title;
    metric.append(
      Object.assign(document.createElement("b"), { textContent: label }),
      document.createTextNode(` ${value}`),
    );
    line.append(metric);
  }
  return line;
}

function renderCard(document: Document, player: LabTelemetryPlayerReport, english: boolean): HTMLElement {
  const card = document.createElement("section");
  card.className = "lab-telemetry-card";
  const heading = document.createElement("div");
  heading.className = "lab-telemetry-card__heading";
  const name = document.createElement("strong");
  name.textContent = `P${player.playerId} · ${player.label}`;
  const state = document.createElement("span");
  state.className = player.gameplay.alive ? "is-live" : "is-down";
  state.textContent = player.gameplay.alive
    ? (english ? player.status : ({ waiting: "aguardando", thinking: "pensando", acting: "jogando", error: "erro", stopped: "parado" })[player.status])
    : (english ? "down" : "fora");
  heading.append(name, state);

  const timing = metricLine(document, [
    ["AVG", formatMetric(player.timing.averageMs, "ms"), english ? "Average decision time" : "Tempo médio de decisão"],
    ["P95", formatMetric(player.timing.p95Ms, "ms"), english ? "95th percentile decision time" : "Percentil 95 do tempo de decisão"],
    ["DEC", formatMetric(player.decisions.perSecond, "/s"), english ? "Decisions per second" : "Decisões por segundo"],
    ["ERR", String(player.decisions.errors), english ? "Decision errors" : "Erros de decisão"],
  ]);
  const behavior = metricLine(document, [
    ["MOV", formatMetric(player.actions.movementPct, "%"), english ? "Movement intent" : "Intenção de movimento"],
    ["BOMB", formatMetric(player.actions.bombIntentPct, "%"), english ? "Bomb intent" : "Intenção de bomba"],
    ["SKILL", formatMetric(player.actions.skillIntentPct, "%"), english ? "Skill intent" : "Intenção de skill"],
    ["Δ", formatMetric(player.actions.changeRatePct, "%"), english ? "Action change rate" : "Taxa de mudança de ação"],
  ]);
  const gameplay = metricLine(document, [
    ["K", String(player.gameplay.kills), english ? "Kills" : "Abates"],
    ["W", String(player.gameplay.roundWins), english ? "Round wins" : "Rounds vencidos"],
    ["B", `${player.gameplay.bombsAvailable}/${player.gameplay.bombCapacity}`, english ? "Bombs available/capacity" : "Bombas disponíveis/capacidade"],
    ["F", String(player.gameplay.flameRange), english ? "Flame range" : "Alcance da explosão"],
    ["SPD", String(player.gameplay.speedLevel), english ? "Speed level" : "Nível de velocidade"],
    ["SH", String(player.gameplay.shieldCharges), english ? "Shield charges" : "Cargas de escudo"],
    ["RC", String(player.gameplay.remoteLevel), english ? "Remote control level" : "Nível de controle remoto"],
    ["BP", String(player.gameplay.bombPassLevel), english ? "Bomb pass level" : "Nível de atravessar bombas"],
    ["KICK", String(player.gameplay.kickLevel), english ? "Kick level" : "Nível de chute"],
    ["SF", String(player.gameplay.shortFuseLevel), english ? "Short fuse level" : "Nível de fusível curto"],
  ]);
  card.append(heading, timing);
  if (player.kind === "llm") {
    card.append(metricLine(document, [
      ["9R", formatMetric(player.timing.upstreamAverageMs, "ms"), "9Router"],
      ["NET", formatMetric(player.timing.transportAverageMs, "ms"), english ? "Browser and proxy overhead" : "Overhead do navegador e proxies"],
      ["GAP", formatMetric(player.timing.pollGapAverageMs, "ms"), english ? "Average gap before the next request" : "Intervalo médio antes da próxima requisição"],
      ["UTIL", formatMetric(player.timing.pollingUtilizationPct, "%"), english ? "Polling time spent waiting for the model" : "Tempo do polling ocupado esperando o modelo"],
      ["TOK", `${player.tokens.inputTokens}/${player.tokens.outputTokens}`, english ? "Input/output tokens" : "Tokens de entrada/saída"],
    ]));
  }
  card.append(behavior, gameplay);
  return card;
}

export function renderLabTelemetryPanel(panel: HTMLElement, report: LabTelemetryReport, english: boolean): void {
  const document = panel.ownerDocument;
  const heading = document.createElement("p");
  heading.className = "lab-live-status__heading";
  heading.textContent = english
    ? `LIVE TELEMETRY · ${(report.sessionElapsedMs / 1000).toFixed(1)}s`
    : `TELEMETRIA AO VIVO · ${(report.sessionElapsedMs / 1000).toFixed(1)}s`;
  const grid = document.createElement("div");
  grid.className = "lab-live-status__grid";
  grid.append(...report.players.map((player) => renderCard(document, player, english)));
  panel.replaceChildren(heading, grid);
}
