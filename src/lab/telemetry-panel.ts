import type { LabTelemetryAction, LabTelemetryPlayerReport, LabTelemetryReport } from "./telemetry";
import { PLAYER_COLORS } from "../original-game/PersonalConfig/config";

type LabView = "arena" | "split" | "data";
type LabTab = "overview" | "actions" | "telemetry";

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatMetric(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  const digits = Math.abs(value) < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(digits)}${suffix}`;
}

function formatAge(value: number | null, english: boolean): string {
  if (value === null) return "—";
  return `${formatMetric(value, "ms")} ${english ? "ago" : "atrás"}`;
}

function translatedStatus(player: LabTelemetryPlayerReport, english: boolean): string {
  if (!player.gameplay.alive) return english ? "down" : "fora";
  if (english) return player.status;
  return ({ waiting: "aguardando", thinking: "pensando", acting: "jogando", error: "erro", stopped: "parado" })[player.status];
}

function presentationStatus(player: LabTelemetryPlayerReport): LabTelemetryPlayerReport["status"] | "down" {
  return player.gameplay.alive ? player.status : "down";
}

function actionParts(action: LabTelemetryAction | null, english: boolean): string[] {
  if (!action) return [english ? "No decision" : "Sem decisão"];
  const directions = english
    ? { up: "↑ Up", down: "↓ Down", left: "← Left", right: "→ Right" }
    : { up: "↑ Cima", down: "↓ Baixo", left: "← Esquerda", right: "→ Direita" };
  const parts = [action.direction ? directions[action.direction] : (english ? "• Hold" : "• Parado")];
  if (action.placeBomb) parts.push(english ? "Bomb" : "Bomba");
  if (action.detonate) parts.push(english ? "Detonate" : "Detonar");
  if (action.useSkill) parts.push("Skill");
  return parts;
}

function metric(document: Document, label: string, value: string, help: string): HTMLElement {
  const item = element(document, "div", "lab-metric");
  item.title = help;
  item.append(
    element(document, "span", "lab-metric__label", label),
    element(document, "strong", "lab-metric__value", value),
  );
  return item;
}

function renderScoreboard(document: Document, report: LabTelemetryReport, english: boolean): HTMLElement {
  const board = element(document, "div", "lab-scoreboard__inner");
  const meta = element(document, "div", "lab-scoreboard__meta");
  meta.append(
    element(document, "span", "lab-scoreboard__eyebrow", english ? "BOT LAB · LIVE" : "LAB DE BOTS · AO VIVO"),
    element(document, "strong", "lab-scoreboard__clock", `${(report.sessionElapsedMs / 1000).toFixed(1)}s`),
  );
  board.append(meta);

  const players = element(document, "div", "lab-scoreboard__players");
  for (const player of report.players) {
    const item = element(document, "article", `lab-score-player is-player-${player.playerId}`);
    item.style.setProperty("--player-accent", PLAYER_COLORS[player.playerId].primary);
    const identity = element(document, "div", "lab-score-player__identity");
    identity.append(
      element(document, "span", "lab-score-player__slot", `P${player.playerId}`),
      element(document, "strong", "lab-score-player__name", player.label),
      element(document, "span", `lab-score-player__state is-${presentationStatus(player)}`, translatedStatus(player, english)),
    );
    const score = element(document, "div", "lab-score-player__score");
    score.append(
      element(document, "strong", "", String(player.gameplay.roundWins)),
      element(document, "span", "", english ? "WINS" : "VITÓRIAS"),
      element(document, "small", "", `${player.gameplay.kills} K · ${player.gameplay.deaths} D`),
    );
    item.append(identity, score);
    players.append(item);
  }
  board.append(players);
  return board;
}

function renderOverview(document: Document, report: LabTelemetryReport, english: boolean): HTMLElement {
  const content = element(document, "div", "lab-report lab-report--overview");
  const ranked = [...report.players].sort((left, right) => (
    right.gameplay.roundWins - left.gameplay.roundWins
    || right.gameplay.kills - left.gameplay.kills
    || left.playerId - right.playerId
  ));
  ranked.forEach((player, index) => {
    const card = element(document, "article", `lab-bot-card is-player-${player.playerId}`);
    card.style.setProperty("--player-accent", PLAYER_COLORS[player.playerId].primary);
    const top = element(document, "div", "lab-bot-card__top");
    const identity = element(document, "div", "lab-bot-card__identity");
    identity.append(
      element(document, "span", "lab-bot-card__rank", `#${index + 1} · P${player.playerId}`),
      element(document, "strong", "", player.label),
      element(document, "small", "", player.kind === "llm" ? "LLM" : (english ? "Deterministic" : "Determinístico")),
    );
    top.append(identity, element(document, "span", `lab-state is-${presentationStatus(player)}`, translatedStatus(player, english)));

    const action = element(document, "div", "lab-current-action");
    action.append(
      element(document, "span", "", english ? "LAST COMMAND" : "ÚLTIMO COMANDO"),
      element(document, "strong", "", actionParts(player.actions.latest, english).join(" · ")),
      element(document, "small", "", formatAge(player.actions.latestAgeMs, english)),
    );
    const metrics = element(document, "div", "lab-metric-grid");
    metrics.append(
      metric(document, english ? "Wins" : "Vitórias", String(player.gameplay.roundWins), english ? "Rounds won" : "Rounds vencidos"),
      metric(document, english ? "Kills" : "Abates", String(player.gameplay.kills), english ? "Total kills" : "Abates totais"),
      metric(
        document,
        english ? "Deaths" : "Mortes",
        String(player.gameplay.deaths),
        english
          ? `Opponent ${player.gameplay.opponentDeaths} · Self ${player.gameplay.selfDeaths} · Sudden death ${player.gameplay.suddenDeathDeaths} · Environment ${player.gameplay.environmentDeaths}`
          : `Adversário ${player.gameplay.opponentDeaths} · Própria ${player.gameplay.selfDeaths} · Sudden death ${player.gameplay.suddenDeathDeaths} · Ambiente ${player.gameplay.environmentDeaths}`,
      ),
      metric(
        document,
        "SELF / SD",
        `${player.gameplay.selfDeaths} / ${player.gameplay.suddenDeathDeaths}`,
        english ? "Self deaths / sudden-death deaths" : "Mortes próprias / mortes por sudden death",
      ),
      metric(document, "AVG", formatMetric(player.timing.averageMs, "ms"), english ? "Average decision time" : "Tempo médio de decisão"),
      metric(
        document,
        player.kind === "llm" ? "LLM/S" : "BOT/S",
        formatMetric(player.decisions.perSecond),
        english ? "Planner decisions per second" : "Decisões do planejador por segundo",
      ),
    );
    if (player.kind === "llm") {
      metrics.append(metric(
        document,
        "MOTOR/S",
        formatMetric(player.motor.perSecond),
        english ? "Local execution cycles per second" : "Ciclos locais de execução por segundo",
      ));
    }
    card.append(top, action, metrics);
    content.append(card);
  });
  return content;
}

function renderActions(document: Document, report: LabTelemetryReport, english: boolean): HTMLElement {
  const content = element(document, "div", "lab-report");
  for (const player of report.players) {
    const card = element(document, "article", `lab-detail-card is-player-${player.playerId}`);
    card.style.setProperty("--player-accent", PLAYER_COLORS[player.playerId].primary);
    const heading = element(document, "header", "lab-detail-card__heading");
    heading.append(
      element(document, "strong", "", `P${player.playerId} · ${player.label}`),
      element(document, "span", "", formatAge(player.actions.latestAgeMs, english)),
    );
    const command = element(document, "div", "lab-command-strip");
    for (const part of actionParts(player.actions.latest, english)) command.append(element(document, "span", "", part));
    const metrics = element(document, "div", "lab-metric-grid lab-metric-grid--dense");
    metrics.append(
      metric(document, english ? "Move" : "Movimento", formatMetric(player.actions.movementPct, "%"), english ? "Movement intent" : "Intenção de movimento"),
      metric(document, english ? "Bomb" : "Bomba", formatMetric(player.actions.bombIntentPct, "%"), english ? "Bomb intent" : "Intenção de bomba"),
      metric(document, english ? "Detonate" : "Detonar", formatMetric(player.actions.detonateIntentPct, "%"), english ? "Detonation intent" : "Intenção de detonação"),
      metric(document, "Skill", formatMetric(player.actions.skillIntentPct, "%"), english ? "Skill intent" : "Intenção de skill"),
      metric(document, "Δ", formatMetric(player.actions.changeRatePct, "%"), english ? "Action change rate" : "Taxa de mudança de ação"),
      metric(document, english ? "Decisions" : "Decisões", String(player.decisions.count), english ? "Total decisions" : "Total de decisões"),
    );
    card.append(heading, command, metrics);
    content.append(card);
  }
  return content;
}

function renderTelemetry(document: Document, report: LabTelemetryReport, english: boolean): HTMLElement {
  const content = element(document, "div", "lab-report");
  for (const player of report.players) {
    const card = element(document, "article", `lab-detail-card is-player-${player.playerId}`);
    card.style.setProperty("--player-accent", PLAYER_COLORS[player.playerId].primary);
    const heading = element(document, "header", "lab-detail-card__heading");
    heading.append(element(document, "strong", "", `P${player.playerId} · ${player.label}`));
    const timing = element(document, "section", "lab-telemetry-section");
    timing.append(
      element(document, "h3", "", english ? "Decision loop" : "Loop de decisão"),
      metric(document, "LAST", formatMetric(player.timing.lastMs, "ms"), english ? "Last decision time" : "Último tempo de decisão"),
      metric(document, "AVG", formatMetric(player.timing.averageMs, "ms"), english ? "Average decision time" : "Tempo médio de decisão"),
      metric(document, "P95", formatMetric(player.timing.p95Ms, "ms"), english ? "95th percentile" : "Percentil 95"),
      metric(
        document,
        player.kind === "llm" ? "LLM/S" : "BOT/S",
        formatMetric(player.decisions.perSecond),
        english ? "Planner decisions per second" : "Decisões do planejador por segundo",
      ),
      metric(document, "ERR", String(player.decisions.errors), english ? "Decision errors" : "Erros de decisão"),
    );
    if (player.kind === "llm") {
      timing.append(
        metric(document, "MOTOR/S", formatMetric(player.motor.perSecond), english ? "Local execution cycles per second" : "Ciclos locais de execução por segundo"),
        metric(
          document,
          "SAFE",
          formatMetric(player.motor.safetyOverridePct, "%"),
          english
            ? `${player.motor.safetyOverrides} local safety overrides`
            : `${player.motor.safetyOverrides} correções locais de segurança`,
        ),
        metric(document, "9R", formatMetric(player.timing.upstreamAverageMs, "ms"), "9Router"),
        metric(document, "NET", formatMetric(player.timing.transportAverageMs, "ms"), english ? "Browser and proxy overhead" : "Overhead do navegador e proxies"),
        metric(document, "GAP", formatMetric(player.timing.pollGapAverageMs, "ms"), english ? "Gap before the next request" : "Intervalo antes da próxima requisição"),
        metric(document, "UTIL", formatMetric(player.timing.pollingUtilizationPct, "%"), english ? "Polling occupied by model wait" : "Polling ocupado esperando o modelo"),
        metric(document, "TOK IN", String(player.tokens.inputTokens), english ? "Input tokens" : "Tokens de entrada"),
        metric(document, "TOK OUT", String(player.tokens.outputTokens), english ? "Output tokens" : "Tokens de saída"),
      );
    }
    const loadout = element(document, "section", "lab-telemetry-section");
    loadout.append(
      element(document, "h3", "", english ? "Loadout" : "Recursos"),
      metric(document, "B", `${player.gameplay.bombsAvailable}/${player.gameplay.bombCapacity}`, english ? "Bombs available/capacity" : "Bombas disponíveis/capacidade"),
      metric(document, "F", String(player.gameplay.flameRange), english ? "Flame range" : "Alcance da explosão"),
      metric(document, "SPD", String(player.gameplay.speedLevel), english ? "Speed level" : "Nível de velocidade"),
      metric(document, "SH", String(player.gameplay.shieldCharges), english ? "Shield charges" : "Cargas de escudo"),
      metric(document, "RC", String(player.gameplay.remoteLevel), english ? "Remote control" : "Controle remoto"),
      metric(document, "BP", String(player.gameplay.bombPassLevel), english ? "Bomb pass" : "Atravessar bombas"),
      metric(document, "KICK", String(player.gameplay.kickLevel), english ? "Kick level" : "Nível de chute"),
      metric(document, "SF", String(player.gameplay.shortFuseLevel), english ? "Short fuse" : "Fusível curto"),
    );
    card.append(heading, timing, loadout);
    content.append(card);
  }
  return content;
}

function controlButton(document: Document, label: string, value: string, active: boolean, type: "view" | "tab"): HTMLButtonElement {
  const button = element(document, "button", active ? "is-active" : "", label);
  button.type = "button";
  button.dataset[type] = value;
  button.setAttribute("aria-pressed", String(active));
  return button;
}

export function createLabConsole(document: Document, english: boolean): Readonly<{
  render(report: LabTelemetryReport): void;
  dispose(): void;
}> {
  const panel = element(document, "aside", "lab-console");
  panel.setAttribute("aria-label", english ? "Bot laboratory console" : "Console do laboratório de bots");
  const scoreboard = element(document, "header", "lab-scoreboard");
  scoreboard.setAttribute("aria-label", english ? "Arena score" : "Placar da arena");
  let view: LabView = "split";
  let tab: LabTab = "overview";
  let latestReport: LabTelemetryReport | null = null;

  const header = element(document, "div", "lab-console__header");
  const brand = element(document, "div", "lab-console__brand");
  const session = element(document, "small");
  brand.append(
    element(document, "span", "lab-console__live", "LIVE"),
    element(document, "strong", "", english ? "OBSERVATION DECK" : "MESA DE OBSERVAÇÃO"),
    session,
  );
  const views = element(document, "div", "lab-segmented lab-view-controls");
  views.setAttribute("aria-label", english ? "Arena size" : "Tamanho da arena");
  const viewButtons: Record<LabView, HTMLButtonElement> = {
    arena: controlButton(document, "Arena", "arena", false, "view"),
    split: controlButton(document, english ? "Split" : "Dividido", "split", true, "view"),
    data: controlButton(document, english ? "Data" : "Dados", "data", false, "view"),
  };
  views.append(viewButtons.arena, viewButtons.split, viewButtons.data);
  header.append(brand, views);

  const nav = element(document, "nav", "lab-segmented lab-console__tabs");
  nav.setAttribute("aria-label", english ? "Laboratory reports" : "Relatórios do laboratório");
  const tabButtons: Record<LabTab, HTMLButtonElement> = {
    overview: controlButton(document, english ? "Overview" : "Visão geral", "overview", true, "tab"),
    actions: controlButton(document, english ? "Actions" : "Ações", "actions", false, "tab"),
    telemetry: controlButton(document, english ? "Telemetry" : "Telemetria", "telemetry", false, "tab"),
  };
  nav.append(tabButtons.overview, tabButtons.actions, tabButtons.telemetry);
  const content = element(document, "div", "lab-console__content");
  panel.append(header, nav, content);

  const syncControls = (): void => {
    for (const [value, button] of Object.entries(viewButtons) as [LabView, HTMLButtonElement][]) {
      const active = value === view;
      button.classList.remove("is-active");
      if (active) button.classList.add("is-active");
      button.setAttribute("aria-pressed", String(active));
    }
    for (const [value, button] of Object.entries(tabButtons) as [LabTab, HTMLButtonElement][]) {
      const active = value === tab;
      button.classList.remove("is-active");
      if (active) button.classList.add("is-active");
      button.setAttribute("aria-pressed", String(active));
    }
  };

  const applyView = (): void => {
    document.body.dataset.labView = view;
    const window = document.defaultView;
    window?.requestAnimationFrame(() => window.dispatchEvent(new window.Event("resize")));
  };

  const render = (report: LabTelemetryReport): void => {
    latestReport = report;
    scoreboard.replaceChildren(renderScoreboard(document, report, english));
    session.textContent = `${report.players.length} BOTS · ${(report.sessionElapsedMs / 1000).toFixed(1)}s`;
    syncControls();
    const scrollTop = content.scrollTop;
    content.replaceChildren(
      tab === "overview"
        ? renderOverview(document, report, english)
        : tab === "actions"
          ? renderActions(document, report, english)
          : renderTelemetry(document, report, english),
    );
    content.scrollTop = scrollTop;
  };

  const handleClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!target) return;
    const nextView = target.dataset.view as LabView | undefined;
    const nextTab = target.dataset.tab as LabTab | undefined;
    if (nextView && (["arena", "split", "data"] as const).includes(nextView)) {
      view = nextView;
      applyView();
    }
    if (nextTab && (["overview", "actions", "telemetry"] as const).includes(nextTab)) tab = nextTab;
    if (latestReport) render(latestReport);
  };

  panel.addEventListener("click", handleClick);
  document.body.append(scoreboard, panel);
  applyView();

  return {
    render,
    dispose: () => {
      panel.removeEventListener("click", handleClick);
      panel.remove();
      scoreboard.remove();
      delete document.body.dataset.labView;
    },
  };
}
