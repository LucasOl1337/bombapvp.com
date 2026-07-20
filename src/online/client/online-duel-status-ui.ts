import type { DuelClientStatus } from "./authoritative-duel-client";

export type OnlineUiLanguage = "pt" | "en";

export function createOnlineDuelConnectionOverlay(
  document: Document,
  root: HTMLElement,
  language: OnlineUiLanguage,
) {
  const section = document.createElement("section");
  section.className = "online-connection";
  section.setAttribute("role", "status");
  section.setAttribute("aria-live", "polite");
  section.setAttribute("aria-atomic", "true");

  const panel = document.createElement("div");
  panel.className = "online-connection__panel";
  const pulse = document.createElement("span");
  pulse.className = "online-connection__pulse";
  pulse.setAttribute("aria-hidden", "true");
  const kicker = document.createElement("p");
  kicker.className = "online-connection__kicker";
  kicker.textContent = language === "en" ? "ONLINE 1V1 DUEL" : "DUELO ONLINE 1V1";
  const title = document.createElement("h1");
  title.className = "online-connection__title";
  const detail = document.createElement("p");
  detail.className = "online-connection__detail";
  const action = document.createElement("a");
  action.className = "online-connection__action";
  action.href = "/";
  action.textContent = language === "en" ? "Return to launcher" : "Voltar ao launcher";
  panel.append(pulse, kicker, title, detail, action);
  section.append(panel);
  root.append(section);

  function render(status: DuelClientStatus, localSeat: 1 | 2 | null = null): void {
    section.dataset.phase = status.phase;
    section.hidden = status.phase === "playing"
      || status.phase === "stopped";
    action.hidden = !["waiting", "ended", "error"].includes(status.phase);
    const copy = statusCopy(status, language, localSeat);
    title.textContent = copy.title;
    detail.textContent = copy.detail;
  }

  return {
    render,
    dispose: () => section.remove(),
  };
}

function statusCopy(
  status: DuelClientStatus,
  language: OnlineUiLanguage,
  localSeat: 1 | 2 | null,
) {
  const en = language === "en";
  switch (status.phase) {
    case "checking":
      return {
        title: en ? "Checking online service" : "Verificando o serviço online",
        detail: en ? "Confirming that the online duel is available." : "Confirmando que o duelo online está disponível.",
      };
    case "connecting-queue":
      return {
        title: en ? "Entering the online duel queue" : "Entrando na fila do duelo online",
        detail: en ? "Connecting to the online service." : "Conectando ao serviço online.",
      };
    case "waiting":
      return {
        title: en ? "Looking for a real rival" : "Procurando um rival real",
        detail: en ? "You will enter only when a second player is ready." : "A arena só começa quando um segundo jogador estiver pronto.",
      };
    case "connecting-match":
    case "waiting-peer":
      return {
        title: en ? "Rival found" : "Rival encontrado",
        detail: en ? "Preparing the match for both players." : "Preparando a partida para os dois jogadores.",
      };
    case "reconnecting":
      return {
        title: en ? "Reconnecting" : "Reconectando",
        detail: en
          ? "Your player session remains active for ten seconds."
          : "Sua sessão de jogador permanece ativa por dez segundos.",
      };
    case "peer-reconnecting":
      return {
        title: en ? "Rival reconnecting" : "O rival está reconectando",
        detail: en
          ? "The rival's commands stay neutral while their player session is preserved."
          : "Os comandos do rival ficam neutros enquanto a sessão dele é preservada.",
      };
    case "ended":
      if (status.code === "completed") {
        const localWon = localSeat !== null && status.winnerSeat === localSeat;
        const localLost = localSeat !== null
          && status.winnerSeat !== null
          && status.winnerSeat !== localSeat;
        return {
          title: localWon
            ? (en ? "Victory" : "Vitória")
            : localLost
              ? (en ? "Defeat" : "Derrota")
              : (en ? "Duel completed" : "Duelo concluído"),
          detail: en
            ? "The final result is ready. Return to the launcher to queue again."
            : "O resultado final está pronto. Volte ao launcher para entrar na fila de novo.",
        };
      }
      if (status.code === "forfeit" || status.code === "peer-forfeited") {
        const localWon = localSeat !== null && status.winnerSeat === localSeat;
        return {
          title: localWon
            ? (en ? "Victory by forfeit" : "Vitória por abandono")
            : (en ? "Match ended by forfeit" : "Partida encerrada por abandono"),
          detail: en
            ? "The rival's player session expired after ten seconds without a connection."
            : "A sessão do rival expirou após dez segundos sem conexão.",
        };
      }
      if (status.code === "server-overload") {
        return {
          title: en ? "Match interrupted" : "Partida interrompida",
          detail: en
            ? "The server interrupted the match instead of letting technical overload make the duel unfair."
            : "O servidor interrompeu a partida para evitar que uma sobrecarga técnica tornasse o duelo injusto.",
        };
      }
      if (status.code === "peer-timeout") {
        return {
          title: en ? "Rival did not connect" : "O rival não conectou",
          detail: en
            ? "The waiting period ended before both players reached the server."
            : "O tempo de espera terminou antes de os dois jogadores chegarem ao servidor.",
        };
      }
      return {
        title: en ? "Match ended" : "Partida encerrada",
        detail: en ? "The online match ended." : "A partida online foi encerrada.",
      };
    case "error":
      return {
        title: en ? "Online PvP is unavailable" : "O PvP online está indisponível",
        detail: en
          ? `No offline match was substituted. Reference: ${status.code ?? "connection-error"}.`
          : `Nenhuma partida offline foi colocada no lugar. Referência: ${status.code ?? "connection-error"}.`,
      };
    default:
      return { title: "", detail: "" };
  }
}
