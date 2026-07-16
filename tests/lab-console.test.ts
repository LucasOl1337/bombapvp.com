import { fireEvent, getByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createLabConsole } from "../src/lab/telemetry-panel.ts";
import type { LabTelemetryPlayerReport, LabTelemetryReport } from "../src/lab/telemetry.ts";

function player(playerId: 1 | 2, label: string): LabTelemetryPlayerReport {
  return {
    playerId,
    label,
    kind: playerId === 1 ? "llm" : "v1",
    status: "acting",
    timing: {
      kind: playerId === 1 ? "round-trip" : "compute",
      lastMs: 120,
      averageMs: 100,
      p95Ms: 140,
      upstreamAverageMs: 80,
      transportAverageMs: 20,
      pollGapAverageMs: 3,
      pollingUtilizationPct: 97,
    },
    decisions: { count: 20, perSecond: 2, errors: 0 },
    motor: { ticks: 200, perSecond: 20, safetyOverrides: 25, safetyOverridePct: 12.5 },
    actions: {
      latest: { direction: "right", placeBomb: true, detonate: true, useSkill: false },
      latestAgeMs: 75,
      changeRatePct: 35,
      movementPct: 90,
      bombIntentPct: 25,
      detonateIntentPct: 10,
      skillIntentPct: 5,
    },
    tokens: { inputTokens: 800, outputTokens: 100, totalTokens: 900 },
    gameplay: {
      alive: true,
      kills: playerId === 1 ? 4 : 2,
      roundWins: playerId === 1 ? 2 : 1,
      deaths: playerId === 1 ? 3 : 5,
      selfDeaths: playerId === 1 ? 1 : 2,
      opponentDeaths: playerId === 1 ? 1 : 2,
      suddenDeathDeaths: 1,
      environmentDeaths: 0,
      bombsAvailable: 1,
      bombCapacity: 2,
      flameRange: 3,
      speedLevel: 2,
      shieldCharges: 0,
      remoteLevel: 1,
      bombPassLevel: 0,
      kickLevel: 0,
      shortFuseLevel: 0,
    },
  };
}

function report(): LabTelemetryReport {
  return {
    sampledAtMs: 10_000,
    sessionElapsedMs: 10_000,
    players: [player(1, "Luna Leve"), player(2, "V1")],
  };
}

afterEach(() => {
  document.body.replaceChildren();
  document.body.removeAttribute("data-lab-view");
});

describe("console do laboratorio", () => {
  it("troca densidade e relatorio sem perder o placar e a identidade dos bots", () => {
    const console = createLabConsole(document, false);
    console.render(report());

    expect(document.body.dataset.labView).toBe("split");
    expect(document.body.textContent).toContain("Luna Leve");
    expect(document.body.textContent).toContain("V1");
    expect(document.body.textContent).toContain("2");
    expect(document.body.textContent).toContain("SELF / SD");
    expect(document.body.textContent).toContain("1 / 1");

    fireEvent.click(getByRole(document.body, "button", { name: "Dados" }));
    expect(document.body.dataset.labView).toBe("data");

    const actionsButton = getByRole(document.body, "button", { name: "Ações" });
    fireEvent.click(actionsButton);
    expect([...document.querySelectorAll(".lab-console__tabs button.is-active")].map((node) => node.textContent)).toEqual(["Ações"]);
    expect(document.body.textContent).toContain("→ Direita");
    expect(document.body.textContent).toContain("Detonar");

    fireEvent.click(getByRole(document.body, "button", { name: "Telemetria" }));
    expect([...document.querySelectorAll(".lab-console__tabs button.is-active")].map((node) => node.textContent)).toEqual(["Telemetria"]);
    expect(document.body.textContent).toContain("Loop de decisão");
    expect(document.body.textContent).toContain("LLM/S");
    expect(document.body.textContent).toContain("MOTOR/S");
    expect(document.body.textContent).toContain("SAFE");
    fireEvent.click(actionsButton);

    const content = document.querySelector<HTMLElement>(".lab-console__content")!;
    content.scrollTop = 120;
    actionsButton.focus();
    console.render({ ...report(), sessionElapsedMs: 10_500 });
    expect(document.activeElement).toBe(actionsButton);
    expect(content.scrollTop).toBe(120);

    console.dispose();
    expect(document.querySelector(".lab-console")).toBeNull();
    expect(document.querySelector(".lab-scoreboard")).toBeNull();
  });

  it("usa o mesmo estado visual de fora quando um bot morreu", () => {
    const console = createLabConsole(document, false);
    const deadV1 = player(2, "V1");
    console.render({
      ...report(),
      players: [player(1, "Luna Leve"), { ...deadV1, gameplay: { ...deadV1.gameplay, alive: false } }],
    });

    const downStates = [...document.querySelectorAll(".is-down")];
    expect(downStates).toHaveLength(2);
    expect(downStates.every((node) => node.textContent === "fora")).toBe(true);
    console.dispose();
  });
});
