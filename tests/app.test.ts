import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, within } from "@testing-library/dom";
import { createBombApp, type BombApp } from "../src/app/index.ts";

describe("Bomba PvP app", () => {
  let app: BombApp | undefined;

  afterEach(() => {
    app?.dispose();
    app = undefined;
    document.body.replaceChildren();
  });

  function createRoot(): HTMLElement {
    const root = document.createElement("div");
    document.body.append(root);
    return root;
  }

  it("abre bombapvp.com em português e bombpvp.com em inglês", () => {
    const portugueseRoot = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root: portugueseRoot });
    expect(app.getSnapshot()).toMatchObject({
      locale: "pt-BR",
      screen: "launcher",
      currentPath: "/",
    });
    expect(app.getSnapshot().experiences.map(({ name }) => name)).toEqual([
      "Sala contínua",
      "Treino contra bots",
      "Laboratório Bot vs Bot",
    ]);

    app.dispose();
    const englishRoot = createRoot();
    app = createBombApp({ hostname: "www.bombpvp.com", root: englishRoot });
    expect(app.getSnapshot().locale).toBe("en");
    expect(within(englishRoot).getByRole("heading", { name: "Choose your experience" })).toBeTruthy();
  });

  it("transforma Sala contínua em uma jornada completa de seleção", () => {
    const root = createRoot();
    const visitedPaths: string[] = [];
    app = createBombApp({
      hostname: "bombapvp.com",
      root,
      onPathChange: (path) => visitedPaths.push(path),
    });
    const view = within(root);

    fireEvent.click(view.getByRole("button", { name: "Jogar agora" }));
    expect(app.getSnapshot()).toMatchObject({
      screen: "character-selection",
      currentPath: "/jogar/personagem",
      activeExperience: { id: "continuous-room", name: "Sala contínua" },
      selectedCharacter: null,
    });
    expect(
      (view.getByRole("button", { name: "Confirmar personagem" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(view.getByRole("button", { name: "Ranni, Escolher" }));
    expect(app.getSnapshot()).toMatchObject({
      selectedCharacter: { name: "Ranni" },
    });
    expect(
      view.getByRole("button", { name: "Ranni, Selecionado" }).getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.click(view.getByRole("button", { name: "Confirmar personagem" }));
    expect(app.getSnapshot()).toMatchObject({
      screen: "launch-ready",
      currentPath: "/jogar/pronto",
      selectedCharacter: { name: "Ranni" },
    });
    expect(view.getByRole("region", { name: "Pronto para entrar" })).toBeTruthy();
    expect(view.getByText("Ranni · Sala contínua")).toBeTruthy();
    expect(visitedPaths).toEqual(["/jogar/personagem", "/jogar/pronto"]);
  });

  it("usa a mesma seleção para treino sem duplicar a experiência", () => {
    const root = createRoot();
    app = createBombApp({
      hostname: "bombapvp.com",
      root,
      initialPath: "/treino/personagem",
    });
    const view = within(root);

    expect(app.getSnapshot()).toMatchObject({
      screen: "character-selection",
      activeExperience: { id: "bot-training" },
    });
    fireEvent.click(view.getByRole("button", { name: "Nico, Escolher" }));
    fireEvent.click(view.getByRole("button", { name: "Confirmar personagem" }));
    expect(app.getSnapshot()).toMatchObject({
      screen: "launch-ready",
      currentPath: "/treino/pronto",
      selectedCharacter: { name: "Nico" },
    });

    fireEvent.click(view.getByRole("button", { name: "Revisar personagem" }));
    expect(app.getSnapshot()).toMatchObject({
      screen: "character-selection",
      currentPath: "/treino/personagem",
      selectedCharacter: { name: "Nico" },
    });
  });

  it("trata o laboratório como produto próprio e declara sua fronteira de conta", () => {
    const root = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root });
    const view = within(root);

    fireEvent.click(view.getByRole("button", { name: "Conhecer o laboratório" }));
    expect(app.getSnapshot()).toMatchObject({
      screen: "laboratory",
      currentPath: "/laboratorio",
      activeExperience: { id: "bot-vs-bot-lab" },
    });
    expect(view.getByRole("region", { name: "Laboratório Bot vs Bot" })).toBeTruthy();
    expect(view.getByText("Contas serão exigidas para salvar e administrar competidores.")).toBeTruthy();
  });

  it("aceita navegação externa, publica mudanças e encerra sem efeitos posteriores", () => {
    const root = createRoot();
    app = createBombApp({ hostname: "bombpvp.com", root });
    const screens: string[] = [];
    const unsubscribe = app.subscribe(({ screen }) => screens.push(screen));

    app.dispatch({ type: "navigate", path: "/jogar/personagem?origem=home" });
    app.dispatch({ type: "navigate", path: "/rota-antiga" });
    expect(screens).toEqual(["character-selection", "launcher"]);

    unsubscribe();
    app.dispatch({ type: "open-experience", experienceId: "bot-training" });
    expect(screens).toEqual(["character-selection", "launcher"]);
    expect(Object.isFrozen(app.getSnapshot())).toBe(true);
    expect(Object.isFrozen(app.getSnapshot().characters)).toBe(true);
    expect(app.getSnapshot().characters.every(Object.isFrozen)).toBe(true);

    app.dispose();
    app.dispatch({ type: "back-to-launcher" });
    expect(root.childElementCount).toBe(0);
  });
});
