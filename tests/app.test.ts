import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, within } from "@testing-library/dom";
import { createBombApp, type BombApp } from "../src/app/index.ts";

describe("Bomba PvP app", () => {
  let app: BombApp | undefined;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      profiles: [
        { id: "sol", label: "GPT 5.6 Sol", route: "cx/gpt-5.6-sol" },
        { id: "fable", label: "Claude Fable 5", route: "cc/claude-fable-5" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
  });

  afterEach(() => {
    app?.dispose();
    app = undefined;
    document.body.replaceChildren();
    vi.unstubAllGlobals();
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
    expect(within(portugueseRoot).getByRole("heading", { name: "Bomba PvP", level: 1 })).toBeTruthy();
    expect(
      within(portugueseRoot).getByRole("complementary", { name: "Personagens" }),
    ).toBeTruthy();
    expect(within(portugueseRoot).getByRole("group", { name: "Idioma" })).toBeTruthy();

    app.dispose();
    const englishRoot = createRoot();
    app = createBombApp({ hostname: "www.bombpvp.com", root: englishRoot });
    expect(app.getSnapshot().locale).toBe("en");
    expect(within(englishRoot).getByRole("heading", { name: "Choose your experience" })).toBeTruthy();
  });

  it("envia a Sala contínua ao motor original após a seleção", () => {
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
      root.querySelector(".app-shell")?.classList.contains("app-shell--screen-update"),
    ).toBe(true);
    expect(
      view.getByRole("button", { name: "Ranni, Selecionado" }).getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.click(view.getByRole("button", { name: "Confirmar personagem" }));
    expect(app.getSnapshot()).toMatchObject({
      screen: "game-launch",
      currentPath: "/arena/?mode=continuous&character=03a976fb-7313-4064-a477-5bb9b0760034",
      selectedCharacter: { name: "Ranni" },
    });
    expect(view.getByRole("region", { name: "Abrindo arena" })).toBeTruthy();
    expect(visitedPaths).toEqual([
      "/jogar/personagem",
      "/arena/?mode=continuous&character=03a976fb-7313-4064-a477-5bb9b0760034",
    ]);
  });

  it("envia o Treino ao motor original com o personagem escolhido", () => {
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
      screen: "game-launch",
      currentPath: "/arena/?mode=training&character=5474c45c-2987-43e0-af2c-a6500c836881",
      selectedCharacter: { name: "Nico" },
    });
    expect(view.getByText("Nico · Treino contra bots")).toBeTruthy();
  });

  it("inicia o laboratório com os dois modelos selecionados", async () => {
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

    const start = await view.findByRole("button", { name: "Iniciar Bot vs Bot" }) as HTMLButtonElement;
    await view.findByText("V1 local + 2 perfis autorizados do 9Router.");
    await vi.waitFor(() => expect(start.disabled).toBe(false));
    fireEvent.click(start);
    expect(app.getSnapshot()).toMatchObject({
      screen: "game-launch",
      currentPath: "/arena/?mode=lab&model1=cx%2Fgpt-5.6-sol&model2=cc%2Fclaude-fable-5",
    });
  });

  it("configura até quatro competidores misturando LLMs e V1", async () => {
    const root = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root, initialPath: "/laboratorio" });
    const view = within(root);

    const playerCount = view.getByRole("combobox", { name: "Quantidade de jogadores" });
    await view.findByText("V1 local + 2 perfis autorizados do 9Router.");
    fireEvent.change(playerCount, { target: { value: "4" } });

    const start = view.getByRole("button", { name: "Iniciar Bot vs Bot" }) as HTMLButtonElement;
    await vi.waitFor(() => expect(start.disabled).toBe(false));
    expect(view.getByRole("combobox", { name: "Modelo do jogador 4" })).toBeTruthy();
    fireEvent.click(start);

    expect(app.getSnapshot()).toMatchObject({
      screen: "game-launch",
      currentPath: "/arena/?mode=lab&model1=cx%2Fgpt-5.6-sol&model2=cc%2Fclaude-fable-5&model3=bot-v1&model4=bot-v1",
    });
  });

  it("mantém o V1 disponível quando o 9Router está fora do ar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const root = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root, initialPath: "/laboratorio" });
    const view = within(root);

    const start = view.getByRole("button", { name: "Iniciar Bot vs Bot" }) as HTMLButtonElement;
    await view.findByText("V1 disponível. O laboratório não conseguiu alcançar o 9Router.");
    expect(root.querySelectorAll('option[value="bot-v1"]')).toHaveLength(4);
    expect(start.disabled).toBe(false);
    fireEvent.click(start);

    expect(app.getSnapshot().currentPath).toBe(
      "/arena/?mode=lab&model1=bot-v1&model2=bot-v1",
    );
  });

  it("libera o V1 mesmo quando a consulta ao 9Router fica pendente", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const root = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root, initialPath: "/laboratorio" });
    const view = within(root);

    const start = view.getByRole("button", { name: "Iniciar Bot vs Bot" }) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    expect(view.getByText("V1 disponível. Consultando modelos do 9Router…")).toBeTruthy();
    fireEvent.click(start);

    expect(app.getSnapshot().currentPath).toBe(
      "/arena/?mode=lab&model1=bot-v1&model2=bot-v1",
    );
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
