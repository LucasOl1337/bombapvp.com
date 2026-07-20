// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
  createOnlineDuelConnectionOverlay,
  type OnlineUiLanguage,
} from "../src/online/client/online-duel-status-ui.ts";

describe("online duel connection UI", () => {
  it("renders honest PT-BR and EN outcomes for every terminal reason", () => {
    const expectedTitles = {
      pt: {
        completed: "Vitória",
        forfeit: "Vitória por abandono",
        "peer-timeout": "O rival não conectou",
        "server-overload": "Partida interrompida",
      },
      en: {
        completed: "Victory",
        forfeit: "Victory by forfeit",
        "peer-timeout": "Rival did not connect",
        "server-overload": "Match interrupted",
      },
    } as const;

    for (const language of ["pt", "en"] as const satisfies readonly OnlineUiLanguage[]) {
      for (const reason of ["completed", "forfeit", "peer-timeout", "server-overload"] as const) {
        const root = document.createElement("main");
        const overlay = createOnlineDuelConnectionOverlay(document, root, language);
        overlay.render({
          phase: "ended",
          code: reason,
          winnerSeat: reason === "completed" || reason === "forfeit" ? 2 : null,
        }, 2);

        const section = root.querySelector<HTMLElement>(".online-connection")!;
        const action = root.querySelector<HTMLElement>(".online-connection__action")!;
        expect(section.hidden).toBe(false);
        expect(section.dataset.phase).toBe("ended");
        expect(action.hidden).toBe(false);
        expect(root.querySelector(".online-connection__title")?.textContent)
          .toBe(expectedTitles[language][reason]);
        expect(root.querySelector(".online-connection__detail")?.textContent?.length)
          .toBeGreaterThan(20);
        if (reason === "forfeit") {
          expect(root.querySelector(".online-connection__detail")?.textContent)
            .toBe(language === "en"
              ? "The rival's player session expired after ten seconds without a connection."
              : "A sessão do rival expirou após dez segundos sem conexão.");
        }
        overlay.dispose();
        expect(root.children).toHaveLength(0);
      }
    }
  });

  it("keeps the rival reconnect notice visible as a dedicated non-terminal phase", () => {
    const root = document.createElement("main");
    const overlay = createOnlineDuelConnectionOverlay(document, root, "pt");
    overlay.render({ phase: "peer-reconnecting", deadlineMs: 12_000 }, 2);

    const section = root.querySelector<HTMLElement>(".online-connection")!;
    const action = root.querySelector<HTMLElement>(".online-connection__action")!;
    expect(section.hidden).toBe(false);
    expect(section.dataset.phase).toBe("peer-reconnecting");
    expect(action.hidden).toBe(true);
    expect(root.querySelector(".online-connection__title")?.textContent)
      .toBe("O rival está reconectando");
    expect(root.querySelector(".online-connection__detail")?.textContent)
      .toBe("Os comandos do rival ficam neutros enquanto a sessão dele é preservada.");

    overlay.render({ phase: "playing" }, 2);
    expect(section.hidden).toBe(true);
  });
});
